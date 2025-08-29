import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { Logger, UseGuards, UsePipes, ValidationPipe } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { LeaderboardService } from "../leaderboard.service";
import {
  LeaderboardType,
  LeaderboardPeriod,
} from "../entities/leaderboard.entity";

interface LeaderboardSubscription {
  type: LeaderboardType;
  period: LeaderboardPeriod;
  category: string;
}

interface ConnectedClient {
  id: string;
  userId?: string;
  subscriptions: Set<string>; // Set of subscription keys
}

interface RankChangeEvent {
  userId: string;
  oldRank: number | null;
  newRank: number;
  leaderboardId: string;
  type: LeaderboardType;
  period: LeaderboardPeriod;
  category: string;
  score: number;
}

@WebSocketGateway({
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  path: "/leaderboard-socket",
  namespace: "/leaderboard",
})
@UsePipes(new ValidationPipe({ transform: true }))
export class LeaderboardGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LeaderboardGateway.name);
  private connectedClients = new Map<string, ConnectedClient>();
  private subscriptionRooms = new Map<string, Set<string>>(); // subscription key -> set of socket IDs

  constructor(private readonly leaderboardService: LeaderboardService) {}

  afterInit(server: Server) {
    this.logger.log("Leaderboard WebSocket Gateway initialized");
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected to leaderboard: ${client.id}`);

    this.connectedClients.set(client.id, {
      id: client.id,
      userId: this.getUserIdFromSocket(client),
      subscriptions: new Set(),
    });

    client.emit("leaderboard:connected", {
      socketId: client.id,
      timestamp: new Date(),
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected from leaderboard: ${client.id}`);

    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      // Remove from all subscriptions
      clientInfo.subscriptions.forEach((subscriptionKey) => {
        const room = this.subscriptionRooms.get(subscriptionKey);
        if (room) {
          room.delete(client.id);
          if (room.size === 0) {
            this.subscriptionRooms.delete(subscriptionKey);
          }
        }
      });
    }

    this.connectedClients.delete(client.id);
  }

  @SubscribeMessage("leaderboard:subscribe")
  async handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaderboardSubscription,
  ) {
    try {
      const { type, period, category } = data;
      const subscriptionKey = this.getSubscriptionKey(type, period, category);

      const clientInfo = this.connectedClients.get(client.id);
      if (!clientInfo) {
        throw new Error("Client not found");
      }

      // Add to subscription
      clientInfo.subscriptions.add(subscriptionKey);

      if (!this.subscriptionRooms.has(subscriptionKey)) {
        this.subscriptionRooms.set(subscriptionKey, new Set());
      }
      this.subscriptionRooms.get(subscriptionKey)!.add(client.id);

      // Join socket room
      await client.join(subscriptionKey);

      // Send current leaderboard data
      const rankings = await this.leaderboardService.getRankings(
        type,
        period,
        category,
        100,
      );
      const stats = await this.leaderboardService.getLeaderboardStats(
        type,
        period,
        category,
      );

      client.emit("leaderboard:subscribed", {
        subscriptionKey,
        rankings,
        stats,
        timestamp: new Date(),
      });

      this.logger.log(`Client ${client.id} subscribed to ${subscriptionKey}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe: ${error.message}`);
      client.emit("leaderboard:error", {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage("leaderboard:unsubscribe")
  async handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaderboardSubscription,
  ) {
    try {
      const { type, period, category } = data;
      const subscriptionKey = this.getSubscriptionKey(type, period, category);

      const clientInfo = this.connectedClients.get(client.id);
      if (!clientInfo) {
        throw new Error("Client not found");
      }

      // Remove from subscription
      clientInfo.subscriptions.delete(subscriptionKey);

      const room = this.subscriptionRooms.get(subscriptionKey);
      if (room) {
        room.delete(client.id);
        if (room.size === 0) {
          this.subscriptionRooms.delete(subscriptionKey);
        }
      }

      // Leave socket room
      await client.leave(subscriptionKey);

      client.emit("leaderboard:unsubscribed", {
        subscriptionKey,
        timestamp: new Date(),
      });

      this.logger.log(
        `Client ${client.id} unsubscribed from ${subscriptionKey}`,
      );
    } catch (error) {
      this.logger.error(`Failed to unsubscribe: ${error.message}`);
      client.emit("leaderboard:error", {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage("leaderboard:getTopPlayers")
  async handleGetTopPlayers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaderboardSubscription & { limit?: number },
  ) {
    try {
      const { type, period, category, limit = 10 } = data;
      const topPlayers = await this.leaderboardService.getTopPlayers(
        type,
        period,
        category,
        limit,
      );

      client.emit("leaderboard:topPlayers", {
        type,
        period,
        category,
        topPlayers,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to get top players: ${error.message}`);
      client.emit("leaderboard:error", {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage("leaderboard:getUserRank")
  async handleGetUserRank(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaderboardSubscription & { userId?: string },
  ) {
    try {
      const clientInfo = this.connectedClients.get(client.id);
      const userId = data.userId || clientInfo?.userId;

      if (!userId) {
        throw new Error("User ID not provided");
      }

      const { type, period, category } = data;
      const rank = await this.leaderboardService.getUserRank(
        userId,
        type,
        period,
        category,
      );
      const usersAround = await this.leaderboardService.getUsersAroundRank(
        userId,
        type,
        period,
        category,
        5,
      );

      client.emit("leaderboard:userRank", {
        userId,
        type,
        period,
        category,
        rank,
        usersAround,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to get user rank: ${error.message}`);
      client.emit("leaderboard:error", {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage("leaderboard:getStats")
  async handleGetStats(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: LeaderboardSubscription,
  ) {
    try {
      const { type, period, category } = data;
      const stats = await this.leaderboardService.getLeaderboardStats(
        type,
        period,
        category,
      );

      client.emit("leaderboard:stats", {
        type,
        period,
        category,
        stats,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Failed to get stats: ${error.message}`);
      client.emit("leaderboard:error", {
        success: false,
        error: error.message,
      });
    }
  }

  // Event listeners for real-time updates
  @OnEvent("leaderboard.rank.changed")
  async handleRankChanged(event: RankChangeEvent) {
    const subscriptionKey = this.getSubscriptionKey(
      event.type,
      event.period,
      event.category,
    );

    // Broadcast rank change to all subscribers
    this.server.to(subscriptionKey).emit("leaderboard:rankChanged", {
      userId: event.userId,
      oldRank: event.oldRank,
      newRank: event.newRank,
      score: event.score,
      type: event.type,
      period: event.period,
      category: event.category,
      timestamp: new Date(),
    });

    // Send updated rankings to all subscribers
    const rankings = await this.leaderboardService.getRankings(
      event.type,
      event.period,
      event.category,
      100,
    );
    const stats = await this.leaderboardService.getLeaderboardStats(
      event.type,
      event.period,
      event.category,
    );

    this.server.to(subscriptionKey).emit("leaderboard:updated", {
      rankings,
      stats,
      type: event.type,
      period: event.period,
      category: event.category,
      timestamp: new Date(),
    });

    this.logger.log(
      `Broadcasted rank change for user ${event.userId} to ${subscriptionKey}`,
    );
  }

  @OnEvent("leaderboard.reset")
  async handleLeaderboardReset(event: {
    leaderboardId: string;
    type: LeaderboardType;
    period: LeaderboardPeriod;
    category: string;
    resetAt: Date;
  }) {
    const subscriptionKey = this.getSubscriptionKey(
      event.type,
      event.period,
      event.category,
    );

    // Notify all subscribers about the reset
    this.server.to(subscriptionKey).emit("leaderboard:reset", {
      type: event.type,
      period: event.period,
      category: event.category,
      resetAt: event.resetAt,
      timestamp: new Date(),
    });

    // Send fresh leaderboard data
    const rankings = await this.leaderboardService.getRankings(
      event.type,
      event.period,
      event.category,
      100,
    );
    const stats = await this.leaderboardService.getLeaderboardStats(
      event.type,
      event.period,
      event.category,
    );

    this.server.to(subscriptionKey).emit("leaderboard:updated", {
      rankings,
      stats,
      type: event.type,
      period: event.period,
      category: event.category,
      timestamp: new Date(),
    });

    this.logger.log(`Broadcasted leaderboard reset for ${subscriptionKey}`);
  }

  private getSubscriptionKey(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string,
  ): string {
    return `${type}:${period}:${category}`;
  }

  private getUserIdFromSocket(client: Socket): string | undefined {
    // Extract user ID from socket handshake or authentication
    return (
      (client.handshake.query.userId as string) ||
      (client.handshake.auth?.userId as string) ||
      undefined
    );
  }
}
