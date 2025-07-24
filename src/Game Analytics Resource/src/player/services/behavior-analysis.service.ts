import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import { Cron, CronExpression } from "@nestjs/schedule"
import type { PlayerBehavior } from "../entities/player-behavior.entity"
import type { AnalyticsService } from "../../analytics/services/analytics.service"
import type { ClickHouseService } from "../../analytics/services/clickhouse.service"

export interface PlayerSegment {
  segment: string
  criteria: {
    minSessions?: number
    maxSessions?: number
    minRevenue?: number
    maxRevenue?: number
    minPlayTime?: number
    maxPlayTime?: number
    daysSinceLastSession?: number
  }
  description: string
}

@Injectable()
export class BehaviorAnalysisService {
  private readonly logger = new Logger(BehaviorAnalysisService.name)

  private readonly segments: PlayerSegment[] = [
    {
      segment: "whale",
      criteria: { minRevenue: 100 },
      description: "High-spending players",
    },
    {
      segment: "dolphin",
      criteria: { minRevenue: 10, maxRevenue: 99.99 },
      description: "Medium-spending players",
    },
    {
      segment: "minnow",
      criteria: { minRevenue: 1, maxRevenue: 9.99 },
      description: "Low-spending players",
    },
    {
      segment: "free",
      criteria: { maxRevenue: 0 },
      description: "Free-to-play players",
    },
    {
      segment: "highly_engaged",
      criteria: { minSessions: 10, minPlayTime: 3600 },
      description: "Highly engaged players",
    },
    {
      segment: "at_risk",
      criteria: { daysSinceLastSession: 7 },
      description: "Players at risk of churning",
    },
    {
      segment: "churned",
      criteria: { daysSinceLastSession: 30 },
      description: "Churned players",
    },
  ]

  private behaviorRepository: Repository<PlayerBehavior>
  private analyticsService: AnalyticsService
  private clickHouseService: ClickHouseService

  constructor(
    behaviorRepository: Repository<PlayerBehavior>,
    analyticsService: AnalyticsService,
    clickHouseService: ClickHouseService,
  ) {
    this.behaviorRepository = behaviorRepository
    this.analyticsService = analyticsService
    this.clickHouseService = clickHouseService
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async analyzeDailyBehavior(): Promise<void> {
    this.logger.log("Starting daily behavior analysis")

    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const today = new Date(yesterday)
    today.setDate(today.getDate() + 1)

    try {
      await this.processPlayerBehavior(yesterday, today)
      await this.updatePlayerSegments()
      this.logger.log("Daily behavior analysis completed")
    } catch (error) {
      this.logger.error("Failed to analyze daily behavior", error)
    }
  }

  private async processPlayerBehavior(startDate: Date, endDate: Date): Promise<void> {
    // Get player behavior data from ClickHouse
    const query = `
      SELECT 
        player_id,
        count(DISTINCT session_id) as sessions_count,
        sum(duration) as total_play_time,
        sum(CASE WHEN event_type IN ('purchase', 'iap') THEN value ELSE 0 END) as total_revenue,
        count() as events_count,
        max(timestamp) as last_activity
      FROM analytics_events
      WHERE toDate(timestamp) = '${startDate.toISOString().split("T")[0]}'
      GROUP BY player_id
    `

    const playerData = await this.clickHouseService.getEventMetrics(startDate, endDate, ["player_id"])

    for (const data of playerData) {
      const behaviorMetrics = {
        avgSessionDuration: data.sessions_count > 0 ? data.total_play_time / data.sessions_count : 0,
        eventsPerSession: data.sessions_count > 0 ? data.events_count / data.sessions_count : 0,
        revenuePerSession: data.sessions_count > 0 ? data.total_revenue / data.sessions_count : 0,
        lastActivity: data.last_activity,
      }

      const behavior = this.behaviorRepository.create({
        playerId: data.player_id,
        date: startDate,
        sessionsCount: data.sessions_count || 0,
        totalPlayTime: data.total_play_time || 0,
        totalRevenue: data.total_revenue || 0,
        eventsCount: data.events_count || 0,
        behaviorMetrics,
      })

      await this.behaviorRepository.save(behavior)
    }
  }

  private async updatePlayerSegments(): Promise<void> {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get aggregated behavior data for the last 30 days
    const playerAggregates = await this.behaviorRepository
      .createQueryBuilder("behavior")
      .select([
        "behavior.playerId",
        "SUM(behavior.sessionsCount) as totalSessions",
        "SUM(behavior.totalPlayTime) as totalPlayTime",
        "SUM(behavior.totalRevenue) as totalRevenue",
        "MAX(behavior.date) as lastActiveDate",
      ])
      .where("behavior.date >= :startDate", { startDate: thirtyDaysAgo })
      .groupBy("behavior.playerId")
      .getRawMany()

    for (const player of playerAggregates) {
      const daysSinceLastSession = Math.floor(
        (Date.now() - new Date(player.lastActiveDate).getTime()) / (1000 * 60 * 60 * 24),
      )

      const segment = this.determinePlayerSegment({
        sessions: Number.parseInt(player.totalSessions),
        playTime: Number.parseInt(player.totalPlayTime),
        revenue: Number.parseFloat(player.totalRevenue),
        daysSinceLastSession,
      })

      // Update the most recent behavior record with segment
      await this.behaviorRepository.update(
        {
          playerId: player.playerId,
          date: new Date(player.lastActiveDate),
        },
        { segment },
      )
    }
  }

  private determinePlayerSegment(metrics: {
    sessions: number
    playTime: number
    revenue: number
    daysSinceLastSession: number
  }): string {
    for (const segmentDef of this.segments) {
      const { criteria } = segmentDef
      let matches = true

      if (criteria.minSessions && metrics.sessions < criteria.minSessions) matches = false
      if (criteria.maxSessions && metrics.sessions > criteria.maxSessions) matches = false
      if (criteria.minRevenue && metrics.revenue < criteria.minRevenue) matches = false
      if (criteria.maxRevenue && metrics.revenue > criteria.maxRevenue) matches = false
      if (criteria.minPlayTime && metrics.playTime < criteria.minPlayTime) matches = false
      if (criteria.maxPlayTime && metrics.playTime > criteria.maxPlayTime) matches = false
      if (criteria.daysSinceLastSession && metrics.daysSinceLastSession < criteria.daysSinceLastSession) matches = false

      if (matches) {
        return segmentDef.segment
      }
    }

    return "unclassified"
  }

  async getPlayerSegmentation(days = 30): Promise<any> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const segmentation = await this.behaviorRepository
      .createQueryBuilder("behavior")
      .select([
        "behavior.segment",
        "COUNT(DISTINCT behavior.playerId) as playerCount",
        "AVG(behavior.totalRevenue) as avgRevenue",
        "AVG(behavior.sessionsCount) as avgSessions",
        "AVG(behavior.totalPlayTime) as avgPlayTime",
      ])
      .where("behavior.date >= :startDate", { startDate })
      .andWhere("behavior.segment IS NOT NULL")
      .groupBy("behavior.segment")
      .getRawMany()

    return segmentation.map((segment) => ({
      segment: segment.segment,
      playerCount: Number.parseInt(segment.playerCount),
      avgRevenue: Number.parseFloat(segment.avgRevenue || "0"),
      avgSessions: Number.parseFloat(segment.avgSessions || "0"),
      avgPlayTime: Number.parseFloat(segment.avgPlayTime || "0"),
    }))
  }

  async getRetentionMetrics(cohortDate: Date): Promise<any> {
    const cohorts = await this.clickHouseService.getRetentionCohorts(cohortDate, new Date())

    // Process cohort data into retention metrics
    const retentionData = {}

    for (const cohort of cohorts) {
      const cohortKey = cohort.cohort_week
      if (!retentionData[cohortKey]) {
        retentionData[cohortKey] = {
          cohortDate: cohortKey,
          totalPlayers: 0,
          retention: {},
        }
      }

      if (cohort.week_number === 0) {
        retentionData[cohortKey].totalPlayers = cohort.retained_players
      }

      const retentionRate =
        retentionData[cohortKey].totalPlayers > 0
          ? (cohort.retained_players / retentionData[cohortKey].totalPlayers) * 100
          : 0

      retentionData[cohortKey].retention[`week_${cohort.week_number}`] = {
        players: cohort.retained_players,
        rate: retentionRate,
      }
    }

    return Object.values(retentionData)
  }
}
