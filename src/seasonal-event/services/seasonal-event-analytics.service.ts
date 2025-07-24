import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs/redis';
import { Redis } from 'ioredis';

@Injectable()
export class SeasonalEventAnalyticsService {
  private readonly logger = new Logger(SeasonalEventAnalyticsService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async trackParticipation(userId: string, eventId: string) {
    await this.redis.sadd(`seasonal:event:participants:${eventId}`, userId);
    await this.redis.expire(`seasonal:event:participants:${eventId}`, 60 * 60 * 24 * 30); // 30 days
  }

  async trackCompletion(userId: string, eventId: string) {
    await this.redis.sadd(`seasonal:event:completions:${eventId}`, userId);
    await this.redis.expire(`seasonal:event:completions:${eventId}`, 60 * 60 * 24 * 30);
  }

  async getMetrics(eventId: string) {
    const [participants, completions] = await Promise.all([
      this.redis.scard(`seasonal:event:participants:${eventId}`),
      this.redis.scard(`seasonal:event:completions:${eventId}`),
    ]);
    return {
      participants,
      completions,
    };
  }
} 