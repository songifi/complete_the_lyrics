import { Injectable, NotFoundException, ForbiddenException } from "@nestjs/common"
import { type Model, Types } from "mongoose"
import type { ChatMessage } from "../entities/chat-message.entity"
import type { ChatRoom } from "../entities/chat-room.entity"
import type { CreateMessageDto, UpdateMessageDto, AddReactionDto } from "../dto/create-message.dto"
import type { CreateRoomDto } from "../dto/create-room.dto"
import type { ElasticsearchService } from "@nestjs/elasticsearch"
import type { RedisService } from "../../../common/services/redis.service"
import type { EncryptionService } from "../../../common/services/encryption.service"

@Injectable()
export class ChatService {
  private messageModel: Model<ChatMessage>
  private roomModel: Model<ChatRoom>
  private elasticsearchService: ElasticsearchService
  private redisService: RedisService
  private encryptionService: EncryptionService

  constructor(
    messageModel: Model<ChatMessage>,
    roomModel: Model<ChatRoom>,
    elasticsearchService: ElasticsearchService,
    redisService: RedisService,
    encryptionService: EncryptionService,
  ) {
    this.messageModel = messageModel
    this.roomModel = roomModel
    this.elasticsearchService = elasticsearchService
    this.redisService = redisService
    this.encryptionService = encryptionService
  }

  async createMessage(createMessageDto: CreateMessageDto, senderId: string): Promise<ChatMessage> {
    const room = await this.roomModel.findById(createMessageDto.roomId)
    if (!room) {
      throw new NotFoundException("Room not found")
    }

    // Check if user is participant
    const isParticipant = room.participants.some((p) => p.userId.toString() === senderId)
    if (!isParticipant && room.type !== "public") {
      throw new ForbiddenException("Not authorized to send messages in this room")
    }

    const messageData = {
      ...createMessageDto,
      senderId: new Types.ObjectId(senderId),
      roomId: new Types.ObjectId(createMessageDto.roomId),
    }

    // Encrypt content for private rooms
    if (room.type === "private" || room.type === "direct") {
      messageData["encryptedContent"] = await this.encryptionService.encrypt(createMessageDto.content)
    }

    const message = new this.messageModel(messageData)
    const savedMessage = await message.save()

    // Index in Elasticsearch for search
    await this.indexMessageForSearch(savedMessage)

    // Cache recent messages in Redis
    await this.cacheRecentMessage(savedMessage)

    return savedMessage.populate(["senderId", "roomId"])
  }

  async getMessages(roomId: string, page = 1, limit = 50): Promise<ChatMessage[]> {
    const skip = (page - 1) * limit

    // Try to get from cache first
    const cacheKey = `messages:${roomId}:${page}:${limit}`
    const cachedMessages = await this.redisService.get(cacheKey)

    if (cachedMessages) {
      return JSON.parse(cachedMessages)
    }

    const messages = await this.messageModel
      .find({ roomId: new Types.ObjectId(roomId), isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate(["senderId", "replies"])
      .exec()

    // Cache for 5 minutes
    await this.redisService.setex(cacheKey, 300, JSON.stringify(messages))

    return messages
  }

  async updateMessage(messageId: string, updateMessageDto: UpdateMessageDto, userId: string): Promise<ChatMessage> {
    const message = await this.messageModel.findById(messageId)
    if (!message) {
      throw new NotFoundException("Message not found")
    }

    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException("Not authorized to edit this message")
    }

    message.content = updateMessageDto.content
    message.isEdited = true

    const updatedMessage = await message.save()

    // Update search index
    await this.updateMessageInSearch(updatedMessage)

    return updatedMessage.populate(["senderId", "roomId"])
  }

  async deleteMessage(messageId: string, userId: string): Promise<void> {
    const message = await this.messageModel.findById(messageId)
    if (!message) {
      throw new NotFoundException("Message not found")
    }

    if (message.senderId.toString() !== userId) {
      throw new ForbiddenException("Not authorized to delete this message")
    }

    message.isDeleted = true
    await message.save()

    // Remove from search index
    await this.removeMessageFromSearch(messageId)
  }

  async addReaction(messageId: string, addReactionDto: AddReactionDto, userId: string): Promise<ChatMessage> {
    const message = await this.messageModel.findById(messageId)
    if (!message) {
      throw new NotFoundException("Message not found")
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      (r) => r.userId.toString() === userId && r.emoji === addReactionDto.emoji,
    )

    if (existingReaction) {
      // Remove reaction
      message.reactions = message.reactions.filter(
        (r) => !(r.userId.toString() === userId && r.emoji === addReactionDto.emoji),
      )
    } else {
      // Add reaction
      message.reactions.push({
        emoji: addReactionDto.emoji,
        userId: new Types.ObjectId(userId),
        createdAt: new Date(),
      })
    }

    return message.save()
  }

  async createRoom(createRoomDto: CreateRoomDto, createdBy: string): Promise<ChatRoom> {
    const roomData = {
      ...createRoomDto,
      createdBy: new Types.ObjectId(createdBy),
      participants: [
        {
          userId: new Types.ObjectId(createdBy),
          role: "admin",
          joinedAt: new Date(),
        },
      ],
      settings: {
        maxMembers: createRoomDto.maxMembers || 100,
        allowFileSharing: createRoomDto.allowFileSharing ?? true,
        moderationEnabled: createRoomDto.moderationEnabled ?? true,
      },
    }

    // Add other participants
    if (createRoomDto.participantIds) {
      createRoomDto.participantIds.forEach((participantId) => {
        if (participantId !== createdBy) {
          roomData.participants.push({
            userId: new Types.ObjectId(participantId),
            role: "member",
            joinedAt: new Date(),
          })
        }
      })
    }

    const room = new this.roomModel(roomData)
    return room.save()
  }

  async searchMessages(query: string, roomId?: string): Promise<any> {
    const searchBody: any = {
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: ["content", "senderId.username"],
                fuzziness: "AUTO",
              },
            },
          ],
          filter: [{ term: { isDeleted: false } }],
        },
      },
      sort: [{ createdAt: { order: "desc" } }],
    }

    if (roomId) {
      searchBody.query.bool.filter.push({ term: { roomId } })
    }

    const result = await this.elasticsearchService.search({
      index: "chat_messages",
      body: searchBody,
    })

    return result.body.hits.hits.map((hit) => hit._source)
  }

  private async indexMessageForSearch(message: ChatMessage): Promise<void> {
    try {
      await this.elasticsearchService.index({
        index: "chat_messages",
        id: message._id.toString(),
        body: {
          content: message.content,
          senderId: message.senderId,
          roomId: message.roomId,
          type: message.type,
          createdAt: message.createdAt,
          isDeleted: message.isDeleted,
        },
      })
    } catch (error) {
      console.error("Failed to index message for search:", error)
    }
  }

  private async updateMessageInSearch(message: ChatMessage): Promise<void> {
    try {
      await this.elasticsearchService.update({
        index: "chat_messages",
        id: message._id.toString(),
        body: {
          doc: {
            content: message.content,
            isEdited: message.isEdited,
          },
        },
      })
    } catch (error) {
      console.error("Failed to update message in search:", error)
    }
  }

  private async removeMessageFromSearch(messageId: string): Promise<void> {
    try {
      await this.elasticsearchService.update({
        index: "chat_messages",
        id: messageId,
        body: {
          doc: {
            isDeleted: true,
          },
        },
      })
    } catch (error) {
      console.error("Failed to remove message from search:", error)
    }
  }

  private async cacheRecentMessage(message: ChatMessage): Promise<void> {
    const cacheKey = `recent_messages:${message.roomId}`
    await this.redisService.lpush(cacheKey, JSON.stringify(message))
    await this.redisService.ltrim(cacheKey, 0, 49) // Keep only 50 recent messages
    await this.redisService.expire(cacheKey, 3600) // Expire in 1 hour
  }
}
