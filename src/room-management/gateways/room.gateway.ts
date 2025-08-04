import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { RoomManagementService } from '../services/room-management.service';
import { RoomModerationService } from '../services/room-moderation.service';
import { AuthenticatedUser } from '../interfaces';
import { ActivityType } from '../entities/room-activity.entity';

export interface RoomSocketData {
  user: AuthenticatedUser;
  roomId?: string;
}

export interface RoomEvent {
  type: string;
  roomId: string;
  userId?: string;
  username?: string;
  data?: any;
  timestamp: Date;
}

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:4200'],
    credentials: true,
  },
  namespace: '/rooms',
})
export class RoomGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RoomGateway.name);
  private connectedUsers = new Map<string, Socket[]>(); // userId -> sockets
  private roomConnections = new Map<string, Set<string>>(); // roomId -> userIds

  constructor(
    private readonly jwtService: JwtService,
    private readonly roomService: RoomManagementService,
    private readonly moderationService: RoomModerationService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Room WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} disconnected: No token provided`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const user: AuthenticatedUser = {
        id: payload.sub || payload.id,
        username: payload.username,
        email: payload.email,
      };

      client.data = { user } as RoomSocketData;

      // Track user connections
      if (!this.connectedUsers.has(user.id)) {
        this.connectedUsers.set(user.id, []);
      }
      this.connectedUsers.get(user.id)!.push(client);

      this.logger.log(`User ${user.username} (${user.id}) connected via socket ${client.id}`);

      // Send user their current room memberships
      await this.sendUserRoomMemberships(client, user.id);
    } catch (error) {
      this.logger.error(`Authentication failed for client ${client.id}:`, error);
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const socketData = client.data as RoomSocketData;

    if (socketData?.user) {
      const { user, roomId } = socketData;

      // Remove from room if they were in one
      if (roomId) {
        await this.leaveRoom(client, roomId);
      }

      // Remove from user connections
      const userSockets = this.connectedUsers.get(user.id);
      if (userSockets) {
        const index = userSockets.findIndex((socket) => socket.id === client.id);
        if (index > -1) {
          userSockets.splice(index, 1);
        }
        if (userSockets.length === 0) {
          this.connectedUsers.delete(user.id);
        }
      }

      this.logger.log(`User ${user.username} (${user.id}) disconnected from socket ${client.id}`);
    }
  }

  @SubscribeMessage('join-room')
  @UsePipes(new ValidationPipe())
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; password?: string },
  ) {
    try {
      const socketData = client.data as RoomSocketData;
      if (!socketData?.user) {
        client.emit('error', { message: 'Not authenticated' });
        return;
      }

      const { user } = socketData;
      const { roomId, password } = data;

      // Verify user can join the room
      const room = await this.roomService.getRoomById(roomId);
      if (!room) {
        client.emit('error', { message: 'Room not found' });
        return;
      }

      // Check if user can access the room
      if (!room.canAccess(user.id) && room.hasPassword()) {
        if (!password) {
          client.emit('error', { message: 'Password required' });
          return;
        }
        // Password verification would be handled by the service
      }

      // Leave current room if in one
      if (socketData.roomId) {
        await this.leaveRoom(client, socketData.roomId);
      }

      // Join the new room
      await client.join(roomId);
      client.data = { ...socketData, roomId };

      // Track room connection
      if (!this.roomConnections.has(roomId)) {
        this.roomConnections.set(roomId, new Set());
      }
      this.roomConnections.get(roomId)!.add(user.id);

      // Notify room members
      const event: RoomEvent = {
        type: 'user-joined',
        roomId,
        userId: user.id,
        username: user.username,
        timestamp: new Date(),
      };

      client.to(roomId).emit('room-event', event);
      client.emit('room-joined', { roomId, room });

      this.logger.log(`User ${user.username} joined room ${roomId} via WebSocket`);
    } catch (error) {
      this.logger.error('Error joining room:', error);
      client.emit('error', { message: 'Failed to join room' });
    }
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    const socketData = client.data as RoomSocketData;
    if (socketData?.roomId) {
      await this.leaveRoom(client, socketData.roomId);
    }
  }

  @SubscribeMessage('room-message')
  @UsePipes(new ValidationPipe())
  async handleRoomMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { message: string; type?: string },
  ) {
    const socketData = client.data as RoomSocketData;
    if (!socketData?.user || !socketData?.roomId) {
      client.emit('error', { message: 'Not in a room' });
      return;
    }

    const { user, roomId } = socketData;
    const event: RoomEvent = {
      type: 'message',
      roomId,
      userId: user.id,
      username: user.username,
      data: {
        message: data.message,
        messageType: data.type || 'text',
      },
      timestamp: new Date(),
    };

    this.server.to(roomId).emit('room-event', event);
  }

  // Public methods for service integration
  async broadcastRoomEvent(event: RoomEvent) {
    this.server.to(event.roomId).emit('room-event', event);
  }

  async notifyUserKicked(roomId: string, userId: string, reason?: string) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      for (const socket of userSockets) {
        socket.emit('kicked', { roomId, reason });
        await this.leaveRoom(socket, roomId);
      }
    }
  }

  async notifyUserBanned(roomId: string, userId: string, reason?: string, duration?: number) {
    const userSockets = this.connectedUsers.get(userId);
    if (userSockets) {
      for (const socket of userSockets) {
        socket.emit('banned', { roomId, reason, duration });
        await this.leaveRoom(socket, roomId);
      }
    }
  }

  async notifyUserMuted(roomId: string, userId: string, reason?: string, duration?: number) {
    const event: RoomEvent = {
      type: 'user-muted',
      roomId,
      userId,
      data: { reason, duration },
      timestamp: new Date(),
    };

    this.server.to(roomId).emit('room-event', event);
  }

  async notifyRoomUpdate(roomId: string, changes: any) {
    const event: RoomEvent = {
      type: 'room-updated',
      roomId,
      data: changes,
      timestamp: new Date(),
    };

    this.server.to(roomId).emit('room-event', event);
  }

  async notifyRoomClosed(roomId: string) {
    const event: RoomEvent = {
      type: 'room-closed',
      roomId,
      timestamp: new Date(),
    };

    this.server.to(roomId).emit('room-event', event);

    // Disconnect all users from the room
    const roomSockets = await this.server.in(roomId).fetchSockets();
    for (const socket of roomSockets) {
      // Cast to Socket since we know it's a connected socket
      await this.leaveRoom(socket as unknown as Socket, roomId);
    }
  }

  // Private helper methods
  private async leaveRoom(client: Socket, roomId: string) {
    const socketData = client.data as RoomSocketData;
    if (!socketData?.user) return;

    const { user } = socketData;

    await client.leave(roomId);
    client.data = { ...socketData, roomId: undefined };

    // Remove from room connections tracking
    const roomUsers = this.roomConnections.get(roomId);
    if (roomUsers) {
      roomUsers.delete(user.id);
      if (roomUsers.size === 0) {
        this.roomConnections.delete(roomId);
      }
    }

    // Notify other room members
    const event: RoomEvent = {
      type: 'user-left',
      roomId,
      userId: user.id,
      username: user.username,
      timestamp: new Date(),
    };

    client.to(roomId).emit('room-event', event);
    client.emit('room-left', { roomId });

    this.logger.log(`User ${user.username} left room ${roomId} via WebSocket`);
  }

  private async sendUserRoomMemberships(client: Socket, userId: string) {
    try {
      // This would ideally get the user's current room memberships from the service
      // For now, we'll emit an event that the client can use to request room data
      client.emit('connection-established', { userId });
    } catch (error) {
      this.logger.error('Error sending user room memberships:', error);
    }
  }

  // Method to get room connection statistics
  getRoomStats() {
    const stats = new Map<string, number>();
    for (const [roomId, users] of this.roomConnections) {
      stats.set(roomId, users.size);
    }
    return stats;
  }

  // Method to get connected user count
  getConnectedUsersCount(): number {
    return this.connectedUsers.size;
  }
}
