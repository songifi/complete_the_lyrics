import { Injectable, Logger } from "@nestjs/common";
import { Server, Socket } from "socket.io";

interface Room {
  sessionId: string;
  sockets: Map<string, Socket>;
  metadata: Record<string, any>;
}

@Injectable()
export class RoomManagerService {
  private readonly logger = new Logger(RoomManagerService.name);
  private rooms: Map<string, Room> = new Map();

  createRoom(sessionId: string): void {
    if (!this.rooms.has(sessionId)) {
      this.rooms.set(sessionId, {
        sessionId,
        sockets: new Map(),
        metadata: {},
      });
      this.logger.log(`Created room for session: ${sessionId}`);
    }
  }

  joinRoom(sessionId: string, socket: Socket): boolean {
    const room = this.rooms.get(sessionId);
    if (!room) {
      this.logger.warn(`Attempted to join non-existent room: ${sessionId}`);
      return false;
    }

    room.sockets.set(socket.id, socket);
    socket.join(sessionId);
    this.logger.log(`Socket ${socket.id} joined room: ${sessionId}`);
    return true;
  }

  leaveRoom(sessionId: string, socketId: string): void {
    const room = this.rooms.get(sessionId);
    if (room) {
      room.sockets.delete(socketId);
      this.logger.log(`Socket ${socketId} left room: ${sessionId}`);

      // Clean up empty rooms
      if (room.sockets.size === 0) {
        this.rooms.delete(sessionId);
        this.logger.log(`Removed empty room: ${sessionId}`);
      }
    }
  }

  broadcastToRoom(
    sessionId: string,
    event: string,
    data: any,
    server: Server,
    excludeSocketId?: string
  ): void {
    const room = this.rooms.get(sessionId);
    if (!room) return;

    room.sockets.forEach((socket, socketId) => {
      if (socketId !== excludeSocketId) {
        socket.emit(event, data);
      }
    });
  }

  getRoomSockets(sessionId: string): Socket[] {
    const room = this.rooms.get(sessionId);
    return room ? Array.from(room.sockets.values()) : [];
  }

  getRoomCount(sessionId: string): number {
    const room = this.rooms.get(sessionId);
    return room ? room.sockets.size : 0;
  }

  getAllRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  updateRoomMetadata(sessionId: string, metadata: Record<string, any>): void {
    const room = this.rooms.get(sessionId);
    if (room) {
      room.metadata = { ...room.metadata, ...metadata };
    }
  }
}
