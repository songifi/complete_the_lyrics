import { Injectable, Logger } from "@nestjs/common"
import { type Repository, Between } from "typeorm"
import type { GameAnalytics } from "../entities/game-analytics.entity"
import type { PlayerSession } from "../entities/player-session.entity"
import type { EventsService } from "../../events/services/events.service"
import type { ClickHouseService } from "./clickhouse.service"
import { TrackMetric } from "../decorators/track-metric.decorator"

export interface AnalyticsEvent {
  playerId: string
  sessionId: string
  eventType: string
  eventData: Record<string, any>
  value?: number
  level?: string
  gameMode?: string
  platform?: string
  version?: string
  country?: string
  deviceType?: string
  duration?: number
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name)

  constructor(
    private readonly analyticsRepository: Repository<GameAnalytics>,
    private readonly sessionRepository: Repository<PlayerSession>,
    private readonly eventsService: EventsService,
    private readonly clickHouseService: ClickHouseService,
  ) {}

  @TrackMetric({
    name: "analytics_event_tracked",
    type: "counter",
    description: "Number of analytics events tracked",
    labels: ["eventType", "platform"],
  })
  async trackEvent(event: AnalyticsEvent): Promise<GameAnalytics> {
    try {
      // Save to PostgreSQL for immediate querying
      const analyticsEvent = this.analyticsRepository.create(event)
      const savedEvent = await this.analyticsRepository.save(analyticsEvent)

      // Send to ClickHouse for high-performance analytics
      await this.clickHouseService.insertEvent(event)

      // Publish to Kafka for real-time processing
      await this.eventsService.publishEvent("analytics.event.tracked", {
        ...event,
        id: savedEvent.id,
        timestamp: savedEvent.timestamp,
      })

      this.logger.log(`Event tracked: ${event.eventType} for player ${event.playerId}`)
      return savedEvent
    } catch (error) {
      this.logger.error(`Failed to track event: ${error.message}`, error.stack)
      throw error
    }
  }

  async getPlayerEvents(playerId: string, startDate?: Date, endDate?: Date): Promise<GameAnalytics[]> {
    const query = this.analyticsRepository
      .createQueryBuilder("analytics")
      .where("analytics.playerId = :playerId", { playerId })

    if (startDate && endDate) {
      query.andWhere("analytics.timestamp BETWEEN :startDate AND :endDate", {
        startDate,
        endDate,
      })
    }

    return query.orderBy("analytics.timestamp", "DESC").getMany()
  }

  async getEventsByType(eventType: string, startDate?: Date, endDate?: Date): Promise<GameAnalytics[]> {
    const whereCondition: any = { eventType }

    if (startDate && endDate) {
      whereCondition.timestamp = Between(startDate, endDate)
    }

    return this.analyticsRepository.find({
      where: whereCondition,
      order: { timestamp: "DESC" },
      take: 1000,
    })
  }

  async createSession(playerId: string, metadata: Record<string, any> = {}): Promise<PlayerSession> {
    const session = this.sessionRepository.create({
      playerId,
      metadata,
      platform: metadata.platform,
      deviceType: metadata.deviceType,
      country: metadata.country,
    })

    const savedSession = await this.sessionRepository.save(session)

    await this.eventsService.publishEvent("player.session.started", {
      sessionId: savedSession.id,
      playerId,
      startTime: savedSession.startTime,
      metadata,
    })

    return savedSession
  }

  async endSession(sessionId: string): Promise<PlayerSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
    })

    if (!session) {
      throw new Error("Session not found")
    }

    const endTime = new Date()
    const duration = endTime.getTime() - session.startTime.getTime()

    // Get events count for this session
    const eventsCount = await this.analyticsRepository.count({
      where: { sessionId },
    })

    // Calculate revenue for this session
    const revenueResult = await this.analyticsRepository
      .createQueryBuilder("analytics")
      .select("SUM(analytics.value)", "total")
      .where("analytics.sessionId = :sessionId", { sessionId })
      .andWhere("analytics.eventType IN (:...revenueEvents)", {
        revenueEvents: ["purchase", "iap", "ad_revenue"],
      })
      .getRawOne()

    session.endTime = endTime
    session.duration = Math.floor(duration / 1000) // Convert to seconds
    session.eventsCount = eventsCount
    session.revenue = Number.parseFloat(revenueResult?.total || "0")

    const updatedSession = await this.sessionRepository.save(session)

    await this.eventsService.publishEvent("player.session.ended", {
      sessionId,
      playerId: session.playerId,
      duration: session.duration,
      eventsCount,
      revenue: session.revenue,
    })

    return updatedSession
  }

  async getSessionMetrics(playerId: string, days = 30): Promise<any> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const sessions = await this.sessionRepository.find({
      where: {
        playerId,
        startTime: Between(startDate, new Date()),
      },
      order: { startTime: "DESC" },
    })

    const totalSessions = sessions.length
    const totalDuration = sessions.reduce((sum, session) => sum + (session.duration || 0), 0)
    const totalRevenue = sessions.reduce((sum, session) => sum + (session.revenue || 0), 0)
    const avgSessionDuration = totalSessions > 0 ? totalDuration / totalSessions : 0

    return {
      totalSessions,
      totalDuration,
      totalRevenue,
      avgSessionDuration,
      sessions: sessions.slice(0, 10), // Return last 10 sessions
    }
  }
}
