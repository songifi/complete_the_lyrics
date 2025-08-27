import { Injectable, Logger } from "@nestjs/common";
import { Socket } from "socket.io";

interface ConnectionState {
  playerId: string;
  sessionId: string;
  lastActivity: Date;
  reconnectAttempts: number;
  sessionData: Record<string, any>;
}

@Injectable()
export class ConnectionRecoveryService {
  private readonly logger = new Logger(ConnectionRecoveryService.name);
  private connectionStates: Map<string, ConnectionState> = new Map();
  private readonly maxReconnectAttempts = 3;
  private readonly connectionTimeout = 30000; // 30 seconds

  saveConnectionState(
    socket: Socket,
    playerId: string,
    sessionId: string,
    sessionData: Record<string, any> = {}
  ): void {
    const state: ConnectionState = {
      playerId,
      sessionId,
      lastActivity: new Date(),
      reconnectAttempts: 0,
      sessionData,
    };

    this.connectionStates.set(socket.id, state);
    this.logger.log(`Saved connection state for player ${playerId}`);
  }

  async handleReconnection(
    socket: Socket,
    playerId: string
  ): Promise<ConnectionState | null> {
    // Find existing connection state for this player
    const existingState = Array.from(this.connectionStates.values()).find(
      (state) => state.playerId === playerId
    );

    if (
      existingState &&
      existingState.reconnectAttempts < this.maxReconnectAttempts
    ) {
      existingState.reconnectAttempts++;
      existingState.lastActivity = new Date();

      // Move the state to the new socket ID
      this.removeConnectionState(socket.id);
      this.connectionStates.set(socket.id, existingState);

      this.logger.log(
        `Reconnected player ${playerId} (attempt ${existingState.reconnectAttempts})`
      );
      return existingState;
    }

    if (
      existingState &&
      existingState.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      this.logger.warn(
        `Max reconnection attempts exceeded for player ${playerId}`
      );
    }

    return null;
  }

  removeConnectionState(socketId: string): void {
    const state = this.connectionStates.get(socketId);
    if (state) {
      this.connectionStates.delete(socketId);
      this.logger.log(`Removed connection state for socket ${socketId}`);
    }
  }

  getConnectionState(socketId: string): ConnectionState | undefined {
    return this.connectionStates.get(socketId);
  }

  updateSessionData(socketId: string, sessionData: Record<string, any>): void {
    const state = this.connectionStates.get(socketId);
    if (state) {
      state.sessionData = { ...state.sessionData, ...sessionData };
      state.lastActivity = new Date();
    }
  }

  cleanupExpiredConnections(): void {
    const now = new Date();
    const expiredConnections: string[] = [];

    this.connectionStates.forEach((state, socketId) => {
      const timeSinceLastActivity =
        now.getTime() - state.lastActivity.getTime();
      if (timeSinceLastActivity > this.connectionTimeout) {
        expiredConnections.push(socketId);
      }
    });

    expiredConnections.forEach((socketId) => {
      this.removeConnectionState(socketId);
    });

    if (expiredConnections.length > 0) {
      this.logger.log(
        `Cleaned up ${expiredConnections.length} expired connections`
      );
    }
  }

  startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupExpiredConnections();
    }, 60000); // Run every minute
  }
}
