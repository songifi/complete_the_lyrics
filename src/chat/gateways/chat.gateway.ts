import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  UseGuards,
  UsePipes,
} from "@nestjs/websockets"
import type { Server, Socket } from "socket.io"
import { UseFilters, UseInterceptors } from "@nestjs/common"
import type { ChatService } from "../services/chat.service"
import type { RateLimiterService } from "../services/rate-limiter.service"
import { ChatAccessGuard } from "../guards/chat-access.guard"
import { ProfanityFilterPipe } from "../pipes/profanity-filter.pipe"
import { MessageFormattingPipe } from "../pipes/message-formatting.pipe"
import { WsExceptionFilter } from "../../../common/filters/ws-exception.filter"
import { LoggingInterceptor } from "../../../common/interceptors/logging.interceptor"

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/chat",
})
@UseFilters(WsExceptionFilter)
@UseInterceptors(LoggingInterceptor)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private connectedUsers = new Map<string, string>() // socketId -> userId

  constructor(
    private chatService: ChatService,
    private rateLimiterService: RateLimiterService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      // Extract user ID from token (implement your auth logic)
      const userId = await this.extractUserFromToken(client.handshake.auth.token)
      if (!userId) {
        client.disconnect()
        return
      }

      client.userId = userId
      this.connectedUsers.set(client.id, userId)

      // Join user to their rooms
      await this.joinUserRooms(client, userId)

      // Broadcast user online status
      this.server.emit("user_online", { userId, timestamp: new Date() })

      console.log(`User ${userId} connected with socket ${client.id}`)
    } catch (error) {
      console.error("Connection error:", error)
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedUsers.get(client.id)
    if (userId) {
      this.connectedUsers.delete(client.id)
      this.server.emit("user_offline", { userId, timestamp: new Date() })
      console.log(`User ${userId} disconnected`)
    }
  }

  @SubscribeMessage("send_message")
  @UseGuards(ChatAccessGuard)
  @UsePipes(ProfanityFilterPipe, MessageFormattingPipe)
  async handleMessage(client: Socket, data: any) {
    const createMessageDto = data.createMessageDto
    const userId = client.userId

    // Check rate limit
    const canSend = await this.rateLimiterService.checkRateLimit(userId, "message")
    if (!canSend) {
      client.emit("rate_limit_exceeded", {
        message: "Too many messages. Please slow down.",
        retryAfter: 60,
      })
      return
    }

    try {
      const message = await this.chatService.createMessage(createMessageDto, userId)

      // Emit to room participants
      this.server.to(`room_${createMessageDto.roomId}`).emit("new_message", message)

      // If it's a reply, notify the parent message author
      if (createMessageDto.parentMessageId) {
        this.server.to(`room_${createMessageDto.roomId}`).emit("new_reply", {
          parentMessageId: createMessageDto.parentMessageId,
          reply: message,
        })
      }
    } catch (error) {
      client.emit("message_error", { error: error.message })
    }
  }

  @SubscribeMessage("add_reaction")
  @UseGuards(ChatAccessGuard)
  async handleAddReaction(client: Socket, data: any) {
    const reactionData = data.data
    const userId = client.userId

    try {
      const message = await this.chatService.addReaction(reactionData.messageId, reactionData.reaction, userId)

      // Emit to room participants
      this.server.to(`room_${message.roomId}`).emit("reaction_updated", {
        messageId: reactionData.messageId,
        reactions: message.reactions,
      })
    } catch (error) {
      client.emit("reaction_error", { error: error.message })
    }
  }

  @SubscribeMessage("join_room")
  async handleJoinRoom(client: Socket, data: any) {
    try {
      await client.join(`room_${data.roomId}`)
      client.emit("joined_room", { roomId: data.roomId })

      // Notify others in the room
      client.to(`room_${data.roomId}`).emit("user_joined_room", {
        userId: client.userId,
        roomId: data.roomId,
        timestamp: new Date(),
      })
    } catch (error) {
      client.emit("join_room_error", { error: error.message })
    }
  }

  @SubscribeMessage("leave_room")
  async handleLeaveRoom(client: Socket, data: any) {
    try {
      await client.leave(`room_${data.roomId}`)
      client.emit("left_room", { roomId: data.roomId })

      // Notify others in the room
      client.to(`room_${data.roomId}`).emit("user_left_room", {
        userId: client.userId,
        roomId: data.roomId,
        timestamp: new Date(),
      })
    } catch (error) {
      client.emit("leave_room_error", { error: error.message })
    }
  }

  @SubscribeMessage("typing_start")
  async handleTypingStart(client: Socket, data: any) {
    client.to(`room_${data.roomId}`).emit("user_typing", {
      userId: client.userId,
      roomId: data.roomId,
      isTyping: true,
    })
  }

  @SubscribeMessage("typing_stop")
  async handleTypingStop(client: Socket, data: any) {
    client.to(`room_${data.roomId}`).emit("user_typing", {
      userId: client.userId,
      roomId: data.roomId,
      isTyping: false,
    })
  }

  private async extractUserFromToken(token: string): Promise<string | null> {
    // Implement your JWT token validation logic here
    // This is a placeholder implementation
    try {
      // const decoded = jwt.verify(token, process.env.JWT_SECRET);
      // return decoded.userId;
      return "user123" // Placeholder
    } catch (error) {
      return null
    }
  }

  private async joinUserRooms(client: Socket, userId: string) {
    // Get user's rooms and join them
    // This is a placeholder - implement based on your room membership logic
    const userRooms = ["room1", "room2"] // Placeholder

    for (const roomId of userRooms) {
      await client.join(`room_${roomId}`)
    }
  }
}
