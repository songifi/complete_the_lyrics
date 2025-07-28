import { Injectable } from "@nestjs/common"
import type { Cache } from "cache-manager"
import type { MatchHistory } from "../entities/match-history.entity"

@Injectable()
export class MatchCacheService {
  private readonly MATCH_CACHE_PREFIX = "match:"
  private readonly CACHE_TTL = 3600 // 1 hour

  constructor(private cacheManager: Cache) {}

  async cacheMatch(match: MatchHistory): Promise<void> {
    const key = `${this.MATCH_CACHE_PREFIX}${match.id}`
    await this.cacheManager.set(key, match, this.CACHE_TTL)
  }

  async getMatch(matchId: string): Promise<MatchHistory | null> {
    const key = `${this.MATCH_CACHE_PREFIX}${matchId}`
    return this.cacheManager.get<MatchHistory>(key)
  }

  async removeMatch(matchId: string): Promise<void> {
    const key = `${this.MATCH_CACHE_PREFIX}${matchId}`
    await this.cacheManager.del(key)
  }

  async invalidateMatch(matchId: string): Promise<void> {
    await this.removeMatch(matchId)
  }

  // Cache for aggregated data (e.g., user stats, trends)
  async cacheAggregatedData(keySuffix: string, data: any, ttl: number = this.CACHE_TTL): Promise<void> {
    const key = `aggregated:${keySuffix}`
    await this.cacheManager.set(key, data, ttl)
  }

  async getAggregatedData(keySuffix: string): Promise<any | null> {
    const key = `aggregated:${keySuffix}`
    return this.cacheManager.get<any>(key)
  }
}
