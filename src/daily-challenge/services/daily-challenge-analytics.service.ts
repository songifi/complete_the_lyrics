import { Injectable, Logger } from '@nestjs/common';
import { InjectRedis } from '@nestjs/redis';
import { Redis } from 'ioredis';

@Injectable()
export class DailyChallengeAnalyticsService {
  private readonly logger = new Logger(DailyChallengeAnalyticsService.name);

  constructor(@InjectRedis() private readonly redis: Redis) {}

  async trackParticipation(userId: string, date: string) {
    await this.redis.sadd(`challenge:participants:${date}`, userId);
    await this.redis.expire(`challenge:participants:${date}`, 48 * 3600);
  }

  async trackCompletion(userId: string, date: string) {
    await this.redis.sadd(`challenge:completions:${date}`, userId);
    await this.redis.expire(`challenge:completions:${date}`, 48 * 3600);
  }

  async trackShare(userId: string, date: string) {
    await this.redis.incr(`challenge:shares:${date}`);
    await this.redis.expire(`challenge:shares:${date}`, 48 * 3600);
  }

  async getMetrics(date: string) {
    const [participants, completions, shares] = await Promise.all([
      this.redis.scard(`challenge:participants:${date}`),
      this.redis.scard(`challenge:completions:${date}`),
      this.redis.get(`challenge:shares:${date}`),
    ]);
    return {
      participants,
      completions,
      shares: parseInt(shares || '0', 10),
    };
  }
} 