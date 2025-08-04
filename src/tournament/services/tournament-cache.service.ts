import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { Tournament } from '../entities/tournament.entity';
import { ITournamentState } from '../interfaces/tournament.interfaces';

@Injectable()
export class TournamentCacheService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
  ) {}

  private readonly TOURNAMENT_KEY_PREFIX = 'tournament:';
  private readonly TOURNAMENT_STATE_KEY_PREFIX = 'tournament:state:';
  private readonly TOURNAMENT_LIST_KEY = 'tournaments:list';
  private readonly CACHE_TTL = 3600; // 1 hour

  async cacheTournament(tournament: Tournament): Promise<void> {
    const key = this.getTournamentKey(tournament.id);
    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(tournament));

    // Add to tournament list
    await this.redis.sadd(this.TOURNAMENT_LIST_KEY, tournament.id);
  }

  async getTournament(tournamentId: string): Promise<Tournament | null> {
    const key = this.getTournamentKey(tournamentId);
    const cached = await this.redis.get(key);

    if (cached) {
      return JSON.parse(cached) as Tournament;
    }

    return null;
  }

  async cacheTournamentState(
    tournamentId: string,
    state: ITournamentState,
  ): Promise<void> {
    const key = this.getTournamentStateKey(tournamentId);
    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(state));
  }

  async getTournamentState(
    tournamentId: string,
  ): Promise<ITournamentState | null> {
    const key = this.getTournamentStateKey(tournamentId);
    const cached = await this.redis.get(key);

    if (cached) {
      return JSON.parse(cached) as ITournamentState;
    }

    return null;
  }

  async updateTournamentState(
    tournamentId: string,
    updates: Partial<ITournamentState>,
  ): Promise<void> {
    const key = this.getTournamentStateKey(tournamentId);
    const current = await this.getTournamentState(tournamentId);

    if (current) {
      const updated = { ...current, ...updates };
      await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(updated));
    }
  }

  async invalidateTournament(tournamentId: string): Promise<void> {
    const tournamentKey = this.getTournamentKey(tournamentId);
    const stateKey = this.getTournamentStateKey(tournamentId);

    await Promise.all([
      this.redis.del(tournamentKey),
      this.redis.del(stateKey),
      this.redis.srem(this.TOURNAMENT_LIST_KEY, tournamentId),
    ]);
  }

  async cacheActiveMatches(
    tournamentId: string,
    matchIds: string[],
  ): Promise<void> {
    const key = `tournament:${tournamentId}:active_matches`;
    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(matchIds));
  }

  async getActiveMatches(tournamentId: string): Promise<string[]> {
    const key = `tournament:${tournamentId}:active_matches`;
    const cached = await this.redis.get(key);

    return cached ? JSON.parse(cached) : [];
  }

  async cacheLeaderboard(
    tournamentId: string,
    leaderboard: any[],
  ): Promise<void> {
    const key = `tournament:${tournamentId}:leaderboard`;
    await this.redis.setex(key, 300, JSON.stringify(leaderboard)); // 5 minutes TTL for leaderboard
  }

  async getLeaderboard(tournamentId: string): Promise<any[] | null> {
    const key = `tournament:${tournamentId}:leaderboard`;
    const cached = await this.redis.get(key);

    return cached ? JSON.parse(cached) : null;
  }

  async cacheTournamentList(tournaments: Tournament[]): Promise<void> {
    const key = 'tournaments:public';
    await this.redis.setex(key, 300, JSON.stringify(tournaments)); // 5 minutes TTL
  }

  async getTournamentList(): Promise<Tournament[] | null> {
    const key = 'tournaments:public';
    const cached = await this.redis.get(key);

    return cached ? JSON.parse(cached) : null;
  }

  async cacheParticipantCount(
    tournamentId: string,
    count: number,
  ): Promise<void> {
    const key = `tournament:${tournamentId}:participant_count`;
    await this.redis.setex(key, this.CACHE_TTL, count.toString());
  }

  async getParticipantCount(tournamentId: string): Promise<number | null> {
    const key = `tournament:${tournamentId}:participant_count`;
    const cached = await this.redis.get(key);

    return cached ? parseInt(cached, 10) : null;
  }

  async incrementParticipantCount(tournamentId: string): Promise<number> {
    const key = `tournament:${tournamentId}:participant_count`;
    return await this.redis.incr(key);
  }

  async decrementParticipantCount(tournamentId: string): Promise<number> {
    const key = `tournament:${tournamentId}:participant_count`;
    return await this.redis.decr(key);
  }

  async cacheMatchResult(matchId: string, result: any): Promise<void> {
    const key = `match:${matchId}:result`;
    await this.redis.setex(key, this.CACHE_TTL, JSON.stringify(result));
  }

  async getMatchResult(matchId: string): Promise<any | null> {
    const key = `match:${matchId}:result`;
    const cached = await this.redis.get(key);

    return cached ? JSON.parse(cached) : null;
  }

  async setBracketLock(
    tournamentId: string,
    lockDuration = 300,
  ): Promise<boolean> {
    const key = `tournament:${tournamentId}:bracket_lock`;
    const result = await this.redis.set(key, '1', 'EX', lockDuration, 'NX');
    return result === 'OK';
  }

  async releaseBracketLock(tournamentId: string): Promise<void> {
    const key = `tournament:${tournamentId}:bracket_lock`;
    await this.redis.del(key);
  }

  async isBracketLocked(tournamentId: string): Promise<boolean> {
    const key = `tournament:${tournamentId}:bracket_lock`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async cacheUserTournaments(
    userId: string,
    tournaments: Tournament[],
  ): Promise<void> {
    const key = `user:${userId}:tournaments`;
    await this.redis.setex(key, 1800, JSON.stringify(tournaments)); // 30 minutes TTL
  }

  async getUserTournaments(userId: string): Promise<Tournament[] | null> {
    const key = `user:${userId}:tournaments`;
    const cached = await this.redis.get(key);

    return cached ? JSON.parse(cached) : null;
  }

  async invalidateUserTournaments(userId: string): Promise<void> {
    const key = `user:${userId}:tournaments`;
    await this.redis.del(key);
  }

  async cacheTournamentStats(tournamentId: string, stats: any): Promise<void> {
    const key = `tournament:${tournamentId}:stats`;
    await this.redis.setex(key, 1800, JSON.stringify(stats)); // 30 minutes TTL
  }

  async getTournamentStats(tournamentId: string): Promise<any | null> {
    const key = `tournament:${tournamentId}:stats`;
    const cached = await this.redis.get(key);

    return cached ? JSON.parse(cached) : null;
  }

  async setRateLimitKey(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const count = await this.redis.incr(key);

    if (count === 1) {
      await this.redis.expire(key, windowSeconds);
    }

    return count <= limit;
  }

  async getRemainingRequests(key: string, limit: number): Promise<number> {
    const count = await this.redis.get(key);
    const current = count ? parseInt(count, 10) : 0;
    return Math.max(0, limit - current);
  }

  async clearAllTournamentCache(): Promise<void> {
    const tournamentKeys = await this.redis.keys(
      `${this.TOURNAMENT_KEY_PREFIX}*`,
    );
    const stateKeys = await this.redis.keys(
      `${this.TOURNAMENT_STATE_KEY_PREFIX}*`,
    );

    const allKeys = [...tournamentKeys, ...stateKeys, this.TOURNAMENT_LIST_KEY];

    if (allKeys.length > 0) {
      await this.redis.del(...allKeys);
    }
  }

  async getHealthCheck(): Promise<{ status: string; latency: number }> {
    const start = Date.now();

    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      return { status: 'healthy', latency };
    } catch (error) {
      return { status: 'unhealthy', latency: -1 };
    }
  }

  private getTournamentKey(tournamentId: string): string {
    return `${this.TOURNAMENT_KEY_PREFIX}${tournamentId}`;
  }

  private getTournamentStateKey(tournamentId: string): string {
    return `${this.TOURNAMENT_STATE_KEY_PREFIX}${tournamentId}`;
  }
}
