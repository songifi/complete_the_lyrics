import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets"
import type { Server, Socket } from "socket.io"
import { Logger } from "@nestjs/common"
import type { Notification } from "../entities/notification.entity"

@WebSocketGateway({
  cors: {
    origin: "*",
  },
  namespace: "/notifications",
})
export class NotificationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(NotificationGateway.name)
  private userSockets: Map<string, Set<string>> = new Map()

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`)

    // Remove client from user mappings
    for (const [userId, sockets] of this.userSockets.entries()) {
      sockets.delete(client.id)
      if (sockets.size === 0) {
        this.userSockets.delete(userId)
      }
    }
  }

  @SubscribeMessage("join")
  handleJoin(client: Socket, data: { userId: string }) {
    const { userId } = data

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set())
    }

    this.userSockets.get(userId).add(client.id)
    client.join(`user:${userId}`)

    this.logger.log(`User ${userId} joined with socket ${client.id}`)
  }

  @SubscribeMessage("leave")
  handleLeave(client: Socket, data: { userId: string }) {
    const { userId } = data

    if (this.userSockets.has(userId)) {
      this.userSockets.get(userId).delete(client.id)
      if (this.userSockets.get(userId).size === 0) {
        this.userSockets.delete(userId)
      }
    }

    client.leave(`user:${userId}`)
    this.logger.log(`User ${userId} left with socket ${client.id}`)
  }

  async sendToUser(userId: string, notification: Notification): Promise<void> {
    const room = `user:${userId}`
    this.server.to(room).emit("notification", {
      id: notification.id,
      title: notification.title,
      content: notification.content,
      type: notification.type,
      category: notification.category,
      priority: notification.priority,
      metadata: notification.metadata,
      createdAt: notification.createdAt,
    })

    this.logger.log(`Sent real-time notification to user ${userId}`)
  }

  getConnectedUsers(): string[] {
    return Array.from(this.userSockets.keys())
  }

  isUserConnected(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0
  }
}
