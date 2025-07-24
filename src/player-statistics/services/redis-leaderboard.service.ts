import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';

export interface LeaderboardEntry {
  playerId: string;
  username: string;
  score: number;
  rank: number;
  additionalData?: any;
}

@Injectable()
export class RedisLeaderboardService {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  async updatePlayerScore(
    category: string,
    timeframe: string,
    playerId: string,
    username: string,
    score: number,
    additionalData?: any
  ): Promise<void> {
    const key = this.getLeaderboardKey(category, timeframe);
    const member = JSON.stringify({
      playerId,
      username,
      additionalData: additionalData || {}
    });

    await this.redis.zadd(key, score, member);
    
    // Set expiration for time-based leaderboards
    if (timeframe !== 'all-time') {
      const ttl = this.getTTL(timeframe);
      await this.redis.expire(key, ttl);
    }
  }

  async getLeaderboard(
    category: string,
    timeframe: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<LeaderboardEntry[]> {
    const key = this.getLeaderboardKey(category, timeframe);
    const results = await this.redis.zrevrange(
      key, 
      offset, 
      offset + limit - 1, 
      'WITHSCORES'
    );

    const entries: LeaderboardEntry[] = [];
    for (let i = 0; i < results.length; i += 2) {
      const memberData = JSON.parse(results[i]);
      const score = parseFloat(results[i + 1]);
      
      entries.push({
        playerId: memberData.playerId,
        username: memberData.username,
        score,
        rank: offset + (i / 2) + 1,
        additionalData: memberData.additionalData
      });
    }

    return entries;
  }

  async getPlayerRank(
    category: string,
    timeframe: string,
    playerId: string
  ): Promise<{ rank: number; score: number } | null> {
    const key = this.getLeaderboardKey(category, timeframe);
    
    // Find the member with matching playerId
    const members = await this.redis.zrevrange(key, 0, -1, 'WITHSCORES');
    
    for (let i = 0; i < members.length; i += 2) {
      const memberData = JSON.parse(members[i]);
      if (memberData.playerId === playerId) {
        const score = parseFloat(members[i + 1]);
        const rank = (i / 2) + 1;
        return { rank, score };
      }
    }

    return null;
  }

  async removePlayer(category: string, timeframe: string, playerId: string): Promise<void> {
    const key = this.getLeaderboardKey(category, timeframe);
    const members = await this.redis.zrange(key, 0, -1);
    
    for (const member of members) {
      const memberData = JSON.parse(member);
      if (memberData.playerId === playerId) {
        await this.redis.zrem(key, member);
        break;
      }
    }
  }

  private getLeaderboardKey(category: string, timeframe: string): string {
    return `leaderboard:${category}:${timeframe}`;
  }

  private getTTL(timeframe: string): number {
    const ttls = {
      daily: 24 * 60 * 60, // 24 hours
      weekly: 7 * 24 * 60 * 60, // 7 days
      monthly: 30 * 24 * 60 * 60 // 30 days
    };
    return ttls[timeframe] || 0;
  }
}