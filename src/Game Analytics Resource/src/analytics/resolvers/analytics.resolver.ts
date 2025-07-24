import { Resolver, Query, Mutation } from "@nestjs/graphql"
import type { AnalyticsService, AnalyticsEvent } from "../services/analytics.service"
import { GameAnalytics } from "../entities/game-analytics.entity"
import { PlayerSession } from "../entities/player-session.entity"
import type { TrackEventInput, SessionMetricsInput } from "../dto/analytics.dto"

@Resolver(() => GameAnalytics)
export class AnalyticsResolver {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Mutation(() => GameAnalytics)
  async trackEvent(input: TrackEventInput): Promise<GameAnalytics> {
    return this.analyticsService.trackEvent(input as AnalyticsEvent)
  }

  @Query(() => [GameAnalytics])
  async getPlayerEvents(playerId: string, startDate?: Date, endDate?: Date): Promise<GameAnalytics[]> {
    return this.analyticsService.getPlayerEvents(playerId, startDate, endDate)
  }

  @Query(() => [GameAnalytics])
  async getEventsByType(eventType: string, startDate?: Date, endDate?: Date): Promise<GameAnalytics[]> {
    return this.analyticsService.getEventsByType(eventType, startDate, endDate)
  }

  @Mutation(() => PlayerSession)
  async createSession(playerId: string, metadata?: Record<string, any>): Promise<PlayerSession> {
    return this.analyticsService.createSession(playerId, metadata)
  }

  @Mutation(() => PlayerSession)
  async endSession(sessionId: string): Promise<PlayerSession> {
    return this.analyticsService.endSession(sessionId)
  }

  @Query(() => Object)
  async getSessionMetrics(input: SessionMetricsInput): Promise<any> {
    return this.analyticsService.getSessionMetrics(input.playerId, input.days)
  }
}
