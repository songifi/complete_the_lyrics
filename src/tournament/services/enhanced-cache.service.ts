import { Injectable, Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import {
  redisConfig,
  CacheOptions,
  defaultCacheOptions,
} from '../config/redis.config';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { Match } from '../entities/match.entity';
import {
  ITournamentState,
  IBracketStructure,
} from '../interfaces/tournament.interfaces';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: string;
  compressed?: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  avgResponseTime: number;
}

@Injectable()
export class EnhancedCacheService {
  private readonly logger = new Logger(EnhancedCacheService.name);
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    avgResponseTime: 0,
  };
  private responseTimes: number[] = [];

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  // Tournament caching
  async cacheTournament(
    tournament: Tournament,
    options?: CacheOptions,
  ): Promise<void> {
    const opts = {
      ...defaultCacheOptions,
      ...redisConfig.tournament,
      ...options,
    };
    const key = this.buildKey(opts.prefix, tournament.id);

    try {
      const startTime = Date.now();
      await this.setWithCompression(key, tournament, opts);
      this.updateStats('set', Date.now() - startTime);

      // Also cache tournament list entry
      await this.updateTournamentListCache(tournament);
    } catch (error) {
      this.handleError('cacheTournament', error);
    }
  }

  async getTournament(
    tournamentId: string,
    options?: CacheOptions,
  ): Promise<Tournament | null> {
    const opts = {
      ...defaultCacheOptions,
      ...redisConfig.tournament,
      ...options,
    };
    const key = this.buildKey(opts.prefix, tournamentId);

    try {
      const startTime = Date.now();
      const result = await this.getWithDecompression<Tournament>(key);
      this.updateStats(result ? 'hit' : 'miss', Date.now() - startTime);
      return result;
    } catch (error) {
      this.handleError('getTournament', error);
      return null;
    }
  }

  async invalidateTournament(tournamentId: string): Promise<void> {
    const keys = [
      this.buildKey(redisConfig.tournament.prefix, tournamentId),
      this.buildKey(redisConfig.state.prefix, tournamentId),
      this.buildKey(redisConfig.bracket.prefix, tournamentId),
      this.buildKey(redisConfig.leaderboard.prefix, tournamentId),
      `${redisConfig.match.prefix}tournament:${tournamentId}:*`,
      `${redisConfig.participant.prefix}tournament:${tournamentId}:*`,
    ];

    try {
      const startTime = Date.now();
      await this.deleteMultiple(keys);
      this.updateStats('delete', Date.now() - startTime);

      // Remove from tournament list cache
      await this.removeFromTournamentListCache(tournamentId);
    } catch (error) {
      this.handleError('invalidateTournament', error);
    }
  }

  // Tournament state caching
  async cacheTournamentState(
    tournamentId: string,
    state: ITournamentState,
    options?: CacheOptions,
  ): Promise<void> {
    const opts = { ...defaultCacheOptions, ...redisConfig.state, ...options };
    const key = this.buildKey(opts.prefix, tournamentId);

    try {
      const startTime = Date.now();
      await this.setWithCompression(key, state, opts);
      this.updateStats('set', Date.now() - startTime);
    } catch (error) {
      this.handleError('cacheTournamentState', error);
    }
  }

  async getTournamentState(
    tournamentId: string,
  ): Promise<ITournamentState | null> {
    const key = this.buildKey(redisConfig.state.prefix, tournamentId);

    try {
      const startTime = Date.now();
      const result = await this.getWithDecompression<ITournamentState>(key);
      this.updateStats(result ? 'hit' : 'miss', Date.now() - startTime);
      return result;
    } catch (error) {
      this.handleError('getTournamentState', error);
      return null;
    }
  }

  async updateTournamentState(
    tournamentId: string,
    updates: Partial<ITournamentState>,
  ): Promise<void> {
    const key = this.buildKey(redisConfig.state.prefix, tournamentId);

    try {
      const current = await this.getTournamentState(tournamentId);
      if (current) {
        const updated = { ...current, ...updates, lastUpdated: new Date() };
        await this.cacheTournamentState(tournamentId, updated);
      }
    } catch (error) {
      this.handleError('updateTournamentState', error);
    }
  }

  // Bracket caching
  async cacheBracket(
    tournamentId: string,
    bracket: IBracketStructure,
    options?: CacheOptions,
  ): Promise<void> {
    const opts = { ...defaultCacheOptions, ...redisConfig.bracket, ...options };
    const key = this.buildKey(opts.prefix, tournamentId);

    try {
      const startTime = Date.now();
      await this.setWithCompression(key, bracket, opts);
      this.updateStats('set', Date.now() - startTime);
    } catch (error) {
      this.handleError('cacheBracket', error);
    }
  }

  async getBracket(tournamentId: string): Promise<IBracketStructure | null> {
    const key = this.buildKey(redisConfig.bracket.prefix, tournamentId);

    try {
      const startTime = Date.now();
      const result = await this.getWithDecompression<IBracketStructure>(key);
      this.updateStats(result ? 'hit' : 'miss', Date.now() - startTime);
      return result;
    } catch (error) {
      this.handleError('getBracket', error);
      return null;
    }
  }

  // Match caching
  async cacheMatch(match: Match, options?: CacheOptions): Promise<void> {
    const opts = { ...defaultCacheOptions, ...redisConfig.match, ...options };
    const key = this.buildKey(opts.prefix, match.id);

    try {
      const startTime = Date.now();
      await this.setWithCompression(key, match, opts);
      this.updateStats('set', Date.now() - startTime);

      // Cache match by tournament for quick retrieval
      await this.addToTournamentMatches(match.tournamentId, match.id);
    } catch (error) {
      this.handleError('cacheMatch', error);
    }
  }

  async getMatch(matchId: string): Promise<Match | null> {
    const key = this.buildKey(redisConfig.match.prefix, matchId);

    try {
      const startTime = Date.now();
      const result = await this.getWithDecompression<Match>(key);
      this.updateStats(result ? 'hit' : 'miss', Date.now() - startTime);
      return result;
    } catch (error) {
      this.handleError('getMatch', error);
      return null;
    }
  }

  async cacheActiveMatches(
    tournamentId: string,
    matchIds: string[],
    options?: CacheOptions,
  ): Promise<void> {
    const opts = { ...defaultCacheOptions, ...redisConfig.match, ...options };
    const key = this.buildKey('active_matches:', tournamentId);

    try {
      const startTime = Date.now();
      await this.redis.setex(key, opts.ttl, JSON.stringify(matchIds));
      this.updateStats('set', Date.now() - startTime);
    } catch (error) {
      this.handleError('cacheActiveMatches', error);
    }
  }

  async getActiveMatches(tournamentId: string): Promise<string[]> {
    const key = this.buildKey('active_matches:', tournamentId);

    try {
      const startTime = Date.now();
      const cached = await this.redis.get(key);
      this.updateStats(cached ? 'hit' : 'miss', Date.now() - startTime);
      return cached ? JSON.parse(cached) : [];
    } catch (error) {
      this.handleError('getActiveMatches', error);
      return [];
    }
  }

  // Leaderboard caching
  async cacheLeaderboard(
    tournamentId: string,
    leaderboard: TournamentParticipant[],
    options?: CacheOptions,
  ): Promise<void> {
    const opts = {
      ...defaultCacheOptions,
      ...redisConfig.leaderboard,
      ...options,
    };
    const key = this.buildKey(opts.prefix, tournamentId);

    try {
      const startTime = Date.now();
      await this.setWithCompression(key, leaderboard, opts);
      this.updateStats('set', Date.now() - startTime);
    } catch (error) {
      this.handleError('cacheLeaderboard', error);
    }
  }

  async getLeaderboard(
    tournamentId: string,
  ): Promise<TournamentParticipant[] | null> {
    const key = this.buildKey(redisConfig.leaderboard.prefix, tournamentId);

    try {
      const startTime = Date.now();
      const result =
        await this.getWithDecompression<TournamentParticipant[]>(key);
      this.updateStats(result ? 'hit' : 'miss', Date.now() - startTime);
      return result;
    } catch (error) {
      this.handleError('getLeaderboard', error);
      return null;
    }
  }

  // Participant caching
  async cacheParticipantCount(
    tournamentId: string,
    count: number,
    options?: CacheOptions,
  ): Promise<void> {
    const opts = {
      ...defaultCacheOptions,
      ...redisConfig.participant,
      ...options,
    };
    const key = this.buildKey('participant_count:', tournamentId);

    try {
      await this.redis.setex(key, opts.ttl, count.toString());
    } catch (error) {
      this.handleError('cacheParticipantCount', error);
    }
  }

  async getParticipantCount(tournamentId: string): Promise<number | null> {
    const key = this.buildKey('participant_count:', tournamentId);

    try {
      const cached = await this.redis.get(key);
      return cached ? parseInt(cached, 10) : null;
    } catch (error) {
      this.handleError('getParticipantCount', error);
      return null;
    }
  }

  async incrementParticipantCount(tournamentId: string): Promise<number> {
    const key = this.buildKey('participant_count:', tournamentId);

    try {
      return await this.redis.incr(key);
    } catch (error) {
      this.handleError('incrementParticipantCount', error);
      return 0;
    }
  }

  async decrementParticipantCount(tournamentId: string): Promise<number> {
    const key = this.buildKey('participant_count:', tournamentId);

    try {
      return await this.redis.decr(key);
    } catch (error) {
      this.handleError('decrementParticipantCount', error);
      return 0;
    }
  }

  // Lock mechanisms
  async acquireLock(resource: string, ttl: number = 300): Promise<boolean> {
    const key = this.buildKey(redisConfig.lock.prefix, resource);
    const lockValue = Date.now().toString();

    try {
      const result = await this.redis.set(key, lockValue, 'EX', ttl, 'NX');
      return result === 'OK';
    } catch (error) {
      this.handleError('acquireLock', error);
      return false;
    }
  }

  async releaseLock(resource: string): Promise<void> {
    const key = this.buildKey(redisConfig.lock.prefix, resource);

    try {
      await this.redis.del(key);
    } catch (error) {
      this.handleError('releaseLock', error);
    }
  }

  async isLocked(resource: string): Promise<boolean> {
    const key = this.buildKey(redisConfig.lock.prefix, resource);

    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.handleError('isLocked', error);
      return false;
    }
  }

  // Rate limiting
  async checkRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const rateLimitKey = this.buildKey(redisConfig.rateLimit.prefix, key);

    try {
      const multi = this.redis.multi();
      multi.incr(rateLimitKey);
      multi.expire(rateLimitKey, windowSeconds);

      const results = await multi.exec();
      const count = results[0][1] as number;

      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetTime = Date.now() + windowSeconds * 1000;

      return { allowed, remaining, resetTime };
    } catch (error) {
      this.handleError('checkRateLimit', error);
      return {
        allowed: true,
        remaining: limit,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    }
  }

  // Bulk operations
  async cacheMultiple<T>(
    items: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<void> {
    try {
      const multi = this.redis.multi();

      for (const item of items) {
        const serialized = await this.serialize(item.value, true);
        if (item.ttl) {
          multi.setex(item.key, item.ttl, serialized);
        } else {
          multi.set(item.key, serialized);
        }
      }

      await multi.exec();
      this.stats.sets += items.length;
    } catch (error) {
      this.handleError('cacheMultiple', error);
    }
  }

  async getMultiple<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      const startTime = Date.now();
      const values = await this.redis.mget(...keys);

      const results = await Promise.all(
        values.map(async (value) => {
          if (value === null) {
            this.stats.misses++;
            return null;
          }

          this.stats.hits++;
          return this.deserialize<T>(value);
        }),
      );

      this.updateStats('multiple', Date.now() - startTime);
      return results;
    } catch (error) {
      this.handleError('getMultiple', error);
      return keys.map(() => null);
    }
  }

  async deleteMultiple(patterns: string[]): Promise<void> {
    try {
      const allKeys: string[] = [];

      for (const pattern of patterns) {
        if (pattern.includes('*')) {
          const keys = await this.redis.keys(pattern);
          allKeys.push(...keys);
        } else {
          allKeys.push(pattern);
        }
      }

      if (allKeys.length > 0) {
        await this.redis.del(...allKeys);
        this.stats.deletes += allKeys.length;
      }
    } catch (error) {
      this.handleError('deleteMultiple', error);
    }
  }

  // Health and monitoring
  async getHealthCheck(): Promise<{
    status: string;
    latency: number;
    memory: any;
    stats: CacheStats;
  }> {
    const start = Date.now();

    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      const memory = await this.redis.memory('usage');

      return {
        status: 'healthy',
        latency,
        memory,
        stats: {
          ...this.stats,
          avgResponseTime: this.getAverageResponseTime(),
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        latency: -1,
        memory: null,
        stats: this.stats,
      };
    }
  }

  async clearAllCache(): Promise<void> {
    try {
      const keys = await this.redis.keys('tournament:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
      this.resetStats();
    } catch (error) {
      this.handleError('clearAllCache', error);
    }
  }

  getStats(): CacheStats {
    return { ...this.stats, avgResponseTime: this.getAverageResponseTime() };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      avgResponseTime: 0,
    };
    this.responseTimes = [];
  }

  // Private helper methods
  private buildKey(prefix: string, suffix: string): string {
    return `${prefix}${suffix}`;
  }

  private async setWithCompression<T>(
    key: string,
    value: T,
    options: CacheOptions,
  ): Promise<void> {
    const serialized = await this.serialize(value, options.compress);

    if (options.ttl) {
      await this.redis.setex(key, options.ttl, serialized);
    } else {
      await this.redis.set(key, serialized);
    }
  }

  private async getWithDecompression<T>(key: string): Promise<T | null> {
    const cached = await this.redis.get(key);

    if (!cached) {
      return null;
    }

    return this.deserialize<T>(cached);
  }

  private async serialize<T>(
    value: T,
    compress: boolean = true,
  ): Promise<string> {
    const jsonString = JSON.stringify({
      data: value,
      timestamp: Date.now(),
      version: '1.0',
      compressed: compress,
    });

    if (compress && jsonString.length > 1024) {
      // Only compress large objects
      const compressed = await gzip(Buffer.from(jsonString));
      return compressed.toString('base64');
    }

    return jsonString;
  }

  private async deserialize<T>(value: string): Promise<T | null> {
    try {
      let jsonString = value;

      // Try to decompress if it's base64 encoded
      if (!value.startsWith('{')) {
        try {
          const compressed = Buffer.from(value, 'base64');
          const decompressed = await gunzip(compressed);
          jsonString = decompressed.toString();
        } catch {
          // Not compressed, use as is
        }
      }

      const parsed = JSON.parse(jsonString) as CacheEntry<T>;
      return parsed.data;
    } catch (error) {
      this.logger.error('Failed to deserialize cached value:', error);
      return null;
    }
  }

  private updateStats(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'multiple',
    responseTime: number,
  ): void {
    this.stats[operation === 'multiple' ? 'hits' : operation]++;

    this.responseTimes.push(responseTime);
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-500); // Keep last 500 response times
    }
  }

  private getAverageResponseTime(): number {
    if (this.responseTimes.length === 0) return 0;

    const sum = this.responseTimes.reduce((a, b) => a + b, 0);
    return sum / this.responseTimes.length;
  }

  private handleError(operation: string, error: any): void {
    this.stats.errors++;
    this.logger.error(`Cache operation ${operation} failed:`, error);
  }

  private async updateTournamentListCache(
    tournament: Tournament,
  ): Promise<void> {
    const key = 'tournament_list:public';

    try {
      const existingList = await this.redis.get(key);
      let tournaments: any[] = existingList ? JSON.parse(existingList) : [];

      // Remove existing entry if present
      tournaments = tournaments.filter((t) => t.id !== tournament.id);

      // Add updated tournament
      tournaments.unshift({
        id: tournament.id,
        name: tournament.name,
        format: tournament.format,
        status: tournament.status,
        participantCount: tournament.participantCount,
        startAt: tournament.startAt,
      });

      // Keep only latest 100 tournaments
      tournaments = tournaments.slice(0, 100);

      await this.redis.setex(
        key,
        redisConfig.tournament.ttl,
        JSON.stringify(tournaments),
      );
    } catch (error) {
      this.handleError('updateTournamentListCache', error);
    }
  }

  private async removeFromTournamentListCache(
    tournamentId: string,
  ): Promise<void> {
    const key = 'tournament_list:public';

    try {
      const existingList = await this.redis.get(key);
      if (existingList) {
        const tournaments = JSON.parse(existingList);
        const filtered = tournaments.filter((t) => t.id !== tournamentId);

        await this.redis.setex(
          key,
          redisConfig.tournament.ttl,
          JSON.stringify(filtered),
        );
      }
    } catch (error) {
      this.handleError('removeFromTournamentListCache', error);
    }
  }

  private async addToTournamentMatches(
    tournamentId: string,
    matchId: string,
  ): Promise<void> {
    const key = `tournament_matches:${tournamentId}`;

    try {
      await this.redis.sadd(key, matchId);
      await this.redis.expire(key, redisConfig.match.ttl);
    } catch (error) {
      this.handleError('addToTournamentMatches', error);
    }
  }
}
