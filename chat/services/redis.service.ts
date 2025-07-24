// src/chat/services/redis.service.ts
import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { InjectRedis } from '@nestjs-modules/ioredis';

@Injectable()
export class RedisService {
  constructor(@InjectRedis() private readonly redisClient: Redis) {}

  async addUserToOnlineList(userId: string): Promise<void> {
    await this.redisClient.sadd('online_users', userId);
  }

  async removeUserFromOnlineList(userId: string): Promise<void> {
    await this.redisClient.srem('online_users', userId);
  }

  async getOnlineUsers(): Promise<string[]> {
    return this.redisClient.smembers('online_users');
  }

  async addUserToRoom(roomId: string, userId: string): Promise<void> {
    await this.redisClient.sadd(`room:${roomId}:users`, userId);
  }

  async removeUserFromRoom(roomId: string, userId: string): Promise<void> {
    await this.redisClient.srem(`room:${roomId}:users`, userId);
  }

  async getUsersInRoom(roomId: string): Promise<string[]> {
    return this.redisClient.smembers(`room:${roomId}:users`);
  }

  async checkMessageRateLimit(userId: string): Promise<boolean> {
    const now = Date.now();
    const windowSize = 60 * 1000; // 1 minute
    const maxMessages = 30; // 30 messages per minute

    const key = `rate_limit:${userId}`;
    const timestamps = await this.redisClient.lrange(key, 0, -1);

    // Remove outdated timestamps
    const recentTimestamps = timestamps
      .map((ts) => parseInt(ts))
      .filter((ts) => now - ts < windowSize);

    if (recentTimestamps.length >= maxMessages) {
      return false;
    }

    await this.redisClient.lpush(key, now.toString());
    await this.redisClient.ltrim(key, 0, maxMessages - 1);
    await this.redisClient.expire(key, windowSize / 1000);

    return true;
  }

  async cacheMessage(roomId: string, message: any): Promise<void> {
    await this.redisClient.lpush(
      `room:${roomId}:messages`,
      JSON.stringify(message),
    );
    await this.redisClient.ltrim(`room:${roomId}:messages`, 0, 99); // Keep last 100 messages
  }

  async getCachedMessages(roomId: string, limit = 50): Promise<any[]> {
    const messages = await this.redisClient.lrange(
      `room:${roomId}:messages`,
      0,
      limit - 1,
    );
    return messages.map((msg) => JSON.parse(msg)).reverse();
  }
}
