import { Injectable, NotFoundException } from "@nestjs/common"
import { type Repository, Between, Like } from "typeorm"
import type { MatchHistory, PlayerResult, MatchEvent } from "../entities/match-history.entity"
import type { CreateMatchHistoryDto } from "../dto/create-match-history.dto"
import type { UpdateMatchHistoryDto } from "../dto/update-match-history.dto"
import type { MatchQueryDto } from "../dto/match-query.dto"
import type { MatchCacheService } from "./match-cache.service"

@Injectable()
export class MatchHistoryService {
  private matchHistoryRepository: Repository<MatchHistory>
  private matchCacheService: MatchCacheService

  constructor(matchHistoryRepository: Repository<MatchHistory>, matchCacheService: MatchCacheService) {
    this.matchHistoryRepository = matchHistoryRepository
    this.matchCacheService = matchCacheService
  }

  async createMatch(createMatchDto: CreateMatchHistoryDto): Promise<MatchHistory> {
    const match = this.matchHistoryRepository.create(createMatchDto)
    const savedMatch = await this.matchHistoryRepository.save(match)
    await this.matchCacheService.cacheMatch(savedMatch)
    return savedMatch
  }

  async findMatchById(id: string): Promise<MatchHistory> {
    let match = await this.matchCacheService.getMatch(id)
    if (!match) {
      match = await this.matchHistoryRepository.findOne({ where: { id } })
      if (!match) {
        throw new NotFoundException(`Match with ID "${id}" not found`)
      }
      await this.matchCacheService.cacheMatch(match)
    }
    return match
  }

  async updateMatch(id: string, updateMatchDto: UpdateMatchHistoryDto): Promise<MatchHistory> {
    const match = await this.findMatchById(id)
    Object.assign(match, updateMatchDto)
    const updatedMatch = await this.matchHistoryRepository.save(match)
    await this.matchCacheService.invalidateMatch(id) // Invalidate cache on update
    return updatedMatch
  }

  async deleteMatch(id: string): Promise<void> {
    const result = await this.matchHistoryRepository.delete(id)
    if (result.affected === 0) {
      throw new NotFoundException(`Match with ID "${id}" not found`)
    }
    await this.matchCacheService.removeMatch(id)
  }

  async findAllMatches(query: MatchQueryDto): Promise<MatchHistory[]> {
    const where: any = {}
    if (query.gameMode) {
      where.gameMode = query.gameMode
    }
    if (query.mapName) {
      where.mapName = Like(`%${query.mapName}%`)
    }
    if (query.startDate && query.endDate) {
      where.startTime = Between(new Date(query.startDate), new Date(query.endDate))
    } else if (query.startDate) {
      where.startTime = Between(new Date(query.startDate), new Date())
    } else if (query.endDate) {
      where.startTime = Between(new Date(0), new Date(query.endDate))
    }

    // For userId, we need to query within the JSONB array. This requires a raw query or specific TypeORM JSONB operators.
    // For simplicity, I'll add a basic check here, but for complex JSONB queries, consider TypeORM's `jsonb_contains` or raw SQL.
    // A more robust solution for `userId` filtering in `playerResults` would involve a custom query builder or a view.
    // For now, we'll fetch and filter in memory if userId is provided, or rely on a future Elasticsearch integration.

    const matches = await this.matchHistoryRepository.find({
      where,
      order: { startTime: "DESC" },
      take: query.limit,
      skip: query.offset,
    })

    if (query.userId) {
      return matches.filter((match) => match.playerResults.some((pr) => pr.userId === query.userId))
    }

    return matches
  }

  async getMatchReplay(matchId: string): Promise<MatchEvent[]> {
    const match = await this.findMatchById(matchId)
    return match.replayData
  }

  async getMatchPerformanceAnalysis(matchId: string, userId?: string): Promise<any> {
    const match = await this.findMatchById(matchId)

    let playerResults = match.playerResults
    if (userId) {
      playerResults = playerResults.filter((pr) => pr.userId === userId)
      if (playerResults.length === 0) {
        throw new NotFoundException(`User ${userId} not found in match ${matchId}`)
      }
    }

    const analysis = playerResults.map((pr) => this.calculatePlayerPerformance(pr, match.duration))

    // Example of aggregation: average KDA for the match
    const totalKills = playerResults.reduce((sum, pr) => sum + pr.kills, 0)
    const totalDeaths = playerResults.reduce((sum, pr) => sum + pr.deaths, 0)
    const totalAssists = playerResults.reduce((sum, pr) => sum + pr.assists, 0)

    const averageKDA = totalDeaths > 0 ? (totalKills + totalAssists) / totalDeaths : totalKills + totalAssists

    return {
      matchId: match.id,
      gameMode: match.gameMode,
      mapName: match.mapName,
      duration: match.duration,
      winningTeamId: match.winningTeamId,
      playerAnalysis: analysis,
      aggregatedStats: {
        totalKills,
        totalDeaths,
        totalAssists,
        averageKDA: Number.parseFloat(averageKDA.toFixed(2)),
      },
    }
  }

  private calculatePlayerPerformance(playerResult: PlayerResult, matchDuration: number): any {
    const kda =
      playerResult.deaths > 0
        ? (playerResult.kills + playerResult.assists) / playerResult.deaths
        : playerResult.kills + playerResult.assists
    const damagePerMinute = matchDuration > 0 ? playerResult.damageDealt / (matchDuration / 60) : 0
    const healingPerMinute = matchDuration > 0 ? playerResult.healingDone / (matchDuration / 60) : 0

    return {
      userId: playerResult.userId,
      teamId: playerResult.teamId,
      score: playerResult.score,
      kills: playerResult.kills,
      deaths: playerResult.deaths,
      assists: playerResult.assists,
      kda: Number.parseFloat(kda.toFixed(2)),
      damageDealt: playerResult.damageDealt,
      damageTaken: playerResult.damageTaken,
      healingDone: playerResult.healingDone,
      objectiveScore: playerResult.objectiveScore,
      damagePerMinute: Number.parseFloat(damagePerMinute.toFixed(2)),
      healingPerMinute: Number.parseFloat(healingPerMinute.toFixed(2)),
      ...playerResult.performanceMetrics, // Include any custom metrics
    }
  }

  async getPlayerMatchHistory(userId: string, query: MatchQueryDto): Promise<MatchHistory[]> {
    // This query needs to search within the JSONB array `playerResults` for the `userId`.
    // TypeORM's `jsonb_contains` or raw SQL is ideal here.
    // For demonstration, I'll use a basic approach, but for production, consider a more optimized JSONB query.
    const qb = this.matchHistoryRepository.createQueryBuilder("match")

    qb.where(":userId = ANY(SELECT jsonb_array_elements(match.playerResults)->>'userId')", { userId })

    if (query.gameMode) {
      qb.andWhere("match.gameMode = :gameMode", { gameMode: query.gameMode })
    }
    if (query.mapName) {
      qb.andWhere("match.mapName ILIKE :mapName", { mapName: `%${query.mapName}%` })
    }
    if (query.startDate && query.endDate) {
      qb.andWhere("match.startTime BETWEEN :startDate AND :endDate", {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      })
    } else if (query.startDate) {
      qb.andWhere("match.startTime >= :startDate", { startDate: new Date(query.startDate) })
    } else if (query.endDate) {
      qb.andWhere("match.startTime <= :endDate", { endDate: new Date(query.endDate) })
    }

    qb.orderBy("match.startTime", "DESC")
    qb.take(query.limit)
    qb.skip(query.offset)

    return qb.getMany()
  }

  async getMatchComparison(matchId1: string, matchId2: string): Promise<any> {
    const [match1, match2] = await Promise.all([this.findMatchById(matchId1), this.findMatchById(matchId2)])

    // Basic comparison:
    const comparison = {
      match1: {
        id: match1.id,
        gameMode: match1.gameMode,
        mapName: match1.mapName,
        duration: match1.duration,
        winningTeamId: match1.winningTeamId,
        playerCount: match1.playerResults.length,
      },
      match2: {
        id: match2.id,
        gameMode: match2.gameMode,
        mapName: match2.mapName,
        duration: match2.duration,
        winningTeamId: match2.winningTeamId,
        playerCount: match2.playerResults.length,
      },
      commonPlayers: [],
      // Add more detailed comparisons as needed, e.g., average KDA, damage, etc.
    }

    const players1 = new Set(match1.playerResults.map((p) => p.userId))
    const players2 = new Set(match2.playerResults.map((p) => p.userId))

    comparison.commonPlayers = Array.from(players1).filter((player) => players2.has(player))

    return comparison
  }

  async getPlayerTrends(userId: string, limit = 10): Promise<any> {
    const matches = await this.getPlayerMatchHistory(userId, { limit, offset: 0 })

    if (matches.length === 0) {
      return { userId, trends: {} }
    }

    const trends = {
      kda: [],
      damageDealt: [],
      healingDone: [],
      score: [],
      // Add more metrics as needed
    }

    for (const match of matches) {
      const playerResult = match.playerResults.find((pr) => pr.userId === userId)
      if (playerResult) {
        const performance = this.calculatePlayerPerformance(playerResult, match.duration)
        trends.kda.push({ matchId: match.id, date: match.startTime, value: performance.kda })
        trends.damageDealt.push({
          matchId: match.id,
          date: match.startTime,
          value: performance.damageDealt,
        })
        trends.healingDone.push({
          matchId: match.id,
          date: match.startTime,
          value: performance.healingDone,
        })
        trends.score.push({ matchId: match.id, date: match.startTime, value: performance.score })
      }
    }

    return { userId, trends }
  }
}
