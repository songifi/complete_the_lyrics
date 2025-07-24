// src/chat/services/chat.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ChatMessage,
  ChatMessageDocument,
} from '../entities/chat-message.entity';
import { Room } from '../entities/room.entity';
import { CreateMessageDto } from '../dtos/create-message.dto';
import { EncryptionService } from '../../common/services/encryption.service';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { User } from '../../auth/interfaces/user.interface';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatMessage.name)
    private messageModel: Model<ChatMessageDocument>,
    @InjectModel(Room.name) private roomModel: Model<Room>,
    private readonly encryptionService: EncryptionService,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async createMessage(
    createMessageDto: CreateMessageDto,
  ): Promise<ChatMessage> {
    // Handle private message encryption
    if (createMessageDto.isPrivate) {
      const { encrypted, iv } = await this.encryptionService.encrypt(
        createMessageDto.content,
      );
      createMessageDto.encryptedContent = encrypted;
      createMessageDto.encryptionIv = iv;
      createMessageDto.content = ''; // Clear original content for private messages
    }

    const createdMessage = new this.messageModel(createMessageDto);
    const savedMessage = await createdMessage.save();

    // Index message for search
    await this.indexMessage(savedMessage);

    return savedMessage.populate('sender', 'username email');
  }

  async getMessageById(messageId: string): Promise<ChatMessage> {
    return this.messageModel
      .findById(messageId)
      .populate('sender', 'username email')
      .populate('recipients', 'username email')
      .exec();
  }

  async getMessagesByRoom(
    roomId: string,
    limit = 50,
    before?: Date,
  ): Promise<ChatMessage[]> {
    const query: any = { roomId };
    if (before) {
      query.createdAt = { $lt: before };
    }

    return this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'username email')
      .exec();
  }

  async getPrivateMessages(
    userId: string,
    recipientId: string,
    limit = 50,
    before?: Date,
  ): Promise<ChatMessage[]> {
    const query: any = {
      isPrivate: true,
      $or: [
        { sender: userId, recipients: recipientId },
        { sender: recipientId, recipients: userId },
      ],
    };

    if (before) {
      query.createdAt = { $lt: before };
    }

    return this.messageModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('sender', 'username email')
      .populate('recipients', 'username email')
      .exec();
  }

  async addReaction(
    messageId: string,
    emoji: string,
    userId: string,
  ): Promise<ChatMessage> {
    const message = await this.messageModel.findById(messageId);
    if (!message) {
      throw new Error('Message not found');
    }

    // Find existing reaction for this emoji
    const existingReaction = message.reactions.find((r) => r.emoji === emoji);

    if (existingReaction) {
      // Add user to existing reaction if not already there
      if (!existingReaction.users.includes(userId)) {
        existingReaction.users.push(userId);
      }
    } else {
      // Create new reaction
      message.reactions.push({
        emoji,
        users: [userId],
      });
    }

    const updatedMessage = await message.save();
    return updatedMessage.populate('sender', 'username email');
  }

  async deleteMessage(messageId: string, userId: string): Promise<ChatMessage> {
    const message = await this.messageModel.findOneAndDelete({
      _id: messageId,
      $or: [
        { sender: userId },
        { 'room.moderators': userId }, // Moderators can delete messages
      ],
    });

    if (!message) {
      throw new Error('Message not found or unauthorized');
    }

    // Remove from search index
    await this.elasticsearchService.delete({
      index: 'messages',
      id: messageId,
    });

    return message;
  }

  private async indexMessage(message: ChatMessageDocument): Promise<void> {
    try {
      await this.elasticsearchService.index({
        index: 'messages',
        id: message._id.toString(),
        body: {
          content: message.filteredContent || message.content,
          sender: message.sender,
          roomId: message.roomId,
          threadId: message.threadId,
          isPrivate: message.isPrivate,
          createdAt: message.createdAt,
        },
      });
    } catch (error) {
      console.error('Error indexing message:', error);
    }
  }

  async searchMessages(
    query: string,
    options: {
      roomId?: string;
      userId?: string;
      isPrivate?: boolean;
      fromDate?: Date;
      toDate?: Date;
    },
  ): Promise<ChatMessage[]> {
    const { roomId, userId, isPrivate, fromDate, toDate } = options;

    const searchQuery: any = {
      bool: {
        must: [
          {
            query_string: {
              query: `*${query}*`,
              fields: ['content'],
            },
          },
        ],
        filter: [],
      },
    };

    if (roomId) {
      searchQuery.bool.filter.push({ term: { roomId } });
    }

    if (userId) {
      searchQuery.bool.filter.push({ term: { sender: userId } });
    }

    if (isPrivate !== undefined) {
      searchQuery.bool.filter.push({ term: { isPrivate } });
    }

    if (fromDate || toDate) {
      const range: any = {};
      if (fromDate) range.gte = fromDate;
      if (toDate) range.lte = toDate;
      searchQuery.bool.filter.push({ range: { createdAt: range } });
    }

    const { body } = await this.elasticsearchService.search({
      index: 'messages',
      body: {
        query: searchQuery,
        sort: [{ createdAt: { order: 'desc' } }],
        size: 100,
      },
    });

    const messageIds = body.hits.hits.map((hit: any) => hit._id);
    return this.messageModel
      .find({ _id: { $in: messageIds } })
      .populate('sender', 'username email')
      .exec();
  }
}
