import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RoomEvent } from '../gateways/room.gateway';

export interface RoomEventMessage {
  type: 'room-event' | 'user-action' | 'moderation' | 'system';
  payload: RoomEvent | any;
  timestamp: Date;
  serverId?: string;
}

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);
  private publisher: Redis;
  private subscriber: Redis;
  private eventHandlers = new Map<string, Set<(message: RoomEventMessage) => void>>();
  private readonly serverId: string;

  constructor(private readonly configService: ConfigService) {
    this.serverId = process.env.SERVER_ID || `server-${Math.random().toString(36).substring(7)}`;
  }

  async onModuleInit() {
    await this.initializeRedis();
    await this.setupSubscriptions();
    this.logger.log(`Redis Pub/Sub service initialized for server ${this.serverId}`);
  }

  async onModuleDestroy() {
    await this.cleanup();
  }

  private async initializeRedis() {
    const redisConfig = {
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD'),
      db: this.configService.get('REDIS_DB', 0),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);

    this.publisher.on('error', (err) => {
      this.logger.error('Redis Publisher Error:', err);
    });

    this.subscriber.on('error', (err) => {
      this.logger.error('Redis Subscriber Error:', err);
    });

    this.publisher.on('connect', () => {
      this.logger.log('Redis Publisher connected');
    });

    this.subscriber.on('connect', () => {
      this.logger.log('Redis Subscriber connected');
    });

    await this.publisher.connect();
    await this.subscriber.connect();
  }

  private async setupSubscriptions() {
    // Subscribe to room-specific channels
    this.subscriber.psubscribe('room:*', (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe to room channels:', err);
      } else {
        this.logger.log(`Subscribed to ${count} room channel patterns`);
      }
    });

    // Subscribe to global channels
    this.subscriber.subscribe('room:global', 'room:moderation', 'room:system', (err, count) => {
      if (err) {
        this.logger.error('Failed to subscribe to global channels:', err);
      } else {
        this.logger.log(`Subscribed to ${count} global channels`);
      }
    });

    // Handle incoming messages
    this.subscriber.on('pmessage', (pattern, channel, message) => {
      this.handleMessage(channel, message);
    });

    this.subscriber.on('message', (channel, message) => {
      this.handleMessage(channel, message);
    });
  }

  private handleMessage(channel: string, message: string) {
    try {
      const eventMessage: RoomEventMessage = JSON.parse(message);

      // Don't process messages from the same server instance
      if (eventMessage.serverId === this.serverId) {
        return;
      }

      const handlers = this.eventHandlers.get(channel);
      if (handlers) {
        handlers.forEach((handler) => {
          try {
            handler(eventMessage);
          } catch (error) {
            this.logger.error(`Error in event handler for channel ${channel}:`, error);
          }
        });
      }

      this.logger.debug(`Processed message on channel ${channel}:`, eventMessage.type);
    } catch (error) {
      this.logger.error(`Failed to parse message on channel ${channel}:`, error);
    }
  }

  // Public API for publishing events
  async publishRoomEvent(roomId: string, event: RoomEvent) {
    const message: RoomEventMessage = {
      type: 'room-event',
      payload: event,
      timestamp: new Date(),
      serverId: this.serverId,
    };

    await this.publisher.publish(`room:${roomId}`, JSON.stringify(message));
  }

  async publishUserAction(roomId: string, action: any) {
    const message: RoomEventMessage = {
      type: 'user-action',
      payload: action,
      timestamp: new Date(),
      serverId: this.serverId,
    };

    await this.publisher.publish(`room:${roomId}`, JSON.stringify(message));
  }

  async publishModerationAction(roomId: string, moderation: any) {
    const message: RoomEventMessage = {
      type: 'moderation',
      payload: moderation,
      timestamp: new Date(),
      serverId: this.serverId,
    };

    // Publish to both room-specific and global moderation channels
    await Promise.all([
      this.publisher.publish(`room:${roomId}`, JSON.stringify(message)),
      this.publisher.publish('room:moderation', JSON.stringify(message)),
    ]);
  }

  async publishSystemEvent(event: any) {
    const message: RoomEventMessage = {
      type: 'system',
      payload: event,
      timestamp: new Date(),
      serverId: this.serverId,
    };

    await this.publisher.publish('room:system', JSON.stringify(message));
  }

  // Public API for subscribing to events
  subscribeToRoom(roomId: string, handler: (message: RoomEventMessage) => void) {
    const channel = `room:${roomId}`;
    if (!this.eventHandlers.has(channel)) {
      this.eventHandlers.set(channel, new Set());
    }
    this.eventHandlers.get(channel)!.add(handler);
  }

  subscribeToModeration(handler: (message: RoomEventMessage) => void) {
    const channel = 'room:moderation';
    if (!this.eventHandlers.has(channel)) {
      this.eventHandlers.set(channel, new Set());
    }
    this.eventHandlers.get(channel)!.add(handler);
  }

  subscribeToSystem(handler: (message: RoomEventMessage) => void) {
    const channel = 'room:system';
    if (!this.eventHandlers.has(channel)) {
      this.eventHandlers.set(channel, new Set());
    }
    this.eventHandlers.get(channel)!.add(handler);
  }

  unsubscribeFromRoom(roomId: string, handler: (message: RoomEventMessage) => void) {
    const channel = `room:${roomId}`;
    const handlers = this.eventHandlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.eventHandlers.delete(channel);
      }
    }
  }

  unsubscribeFromModeration(handler: (message: RoomEventMessage) => void) {
    const channel = 'room:moderation';
    const handlers = this.eventHandlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  unsubscribeFromSystem(handler: (message: RoomEventMessage) => void) {
    const channel = 'room:system';
    const handlers = this.eventHandlers.get(channel);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  // Utility methods
  async getRoomSubscriberCount(roomId: string): Promise<number> {
    try {
      const count = await this.publisher.pubsub('NUMSUB', `room:${roomId}`);
      return Array.isArray(count) ? (count[1] as number) || 0 : 0;
    } catch (error) {
      this.logger.error(`Failed to get subscriber count for room ${roomId}:`, error);
      return 0;
    }
  }

  async getActiveChannels(): Promise<string[]> {
    try {
      const channels = await this.publisher.pubsub('CHANNELS', 'room:*');
      return Array.isArray(channels) ? (channels as string[]) : [];
    } catch (error) {
      this.logger.error('Failed to get active channels:', error);
      return [];
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      await this.publisher.ping();
      await this.subscriber.ping();
      return true;
    } catch (error) {
      this.logger.error('Redis health check failed:', error);
      return false;
    }
  }

  private async cleanup() {
    try {
      this.eventHandlers.clear();

      if (this.subscriber) {
        await this.subscriber.punsubscribe();
        await this.subscriber.unsubscribe();
        this.subscriber.disconnect();
      }

      if (this.publisher) {
        this.publisher.disconnect();
      }

      this.logger.log('Redis connections closed');
    } catch (error) {
      this.logger.error('Error during Redis cleanup:', error);
    }
  }
}
