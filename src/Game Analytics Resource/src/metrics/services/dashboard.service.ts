import { Injectable } from "@nestjs/common"
import type { AnalyticsService } from "../../analytics/services/analytics.service"
import type { ClickHouseService } from "../../analytics/services/clickhouse.service"
import type { MetricsService } from "../../analytics/services/metrics.service"

export interface DashboardMetrics {
  realTimeMetrics: {
    activeUsers: number
    eventsPerSecond: number
    revenue: number
    averageSessionDuration: number
  }
  dailyMetrics: {
    date: string
    dau: number
    sessions: number
    revenue: number
    retention: number
  }[]
  topEvents: {
    eventType: string
    count: number
    uniqueUsers: number
  }[]
  platformBreakdown: {
    platform: string
    users: number
    percentage: number
  }[]
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly analyticsService: AnalyticsService,
    private readonly clickHouseService: ClickHouseService,
    private readonly metricsService: MetricsService,
  ) {}

  async getDashboardMetrics(days = 7): Promise<DashboardMetrics> {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const [realTimeMetrics, dailyMetrics, topEvents, platformBreakdown] = await Promise.all([
      this.getRealTimeMetrics(),
      this.getDailyMetrics(startDate, endDate),
      this.getTopEvents(startDate, endDate),
      this.getPlatformBreakdown(startDate, endDate),
    ])

    return {
      realTimeMetrics,
      dailyMetrics,
      topEvents,
      platformBreakdown,
    }
  }

  private async getRealTimeMetrics(): Promise<DashboardMetrics["realTimeMetrics"]> {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    // Get metrics from ClickHouse for the last hour
    const hourlyData = await this.clickHouseService.getEventMetrics(oneHourAgo, now, ["platform"])

    const activeUsers = hourlyData.reduce((sum, row) => sum + row.unique_players, 0)
    const totalEvents = hourlyData.reduce((sum, row) => sum + row.events_count, 0)
    const eventsPerSecond = Math.round(totalEvents / 3600) // Events per second in the last hour
    const revenue = hourlyData.reduce((sum, row) => sum + (row.total_value || 0), 0)

    // Get average session duration from Redis metrics
    const sessionMetrics = await this.metricsService.getMetrics("session_duration")
    const averageSessionDuration = sessionMetrics?.avg || 0

    return {
      activeUsers,
      eventsPerSecond,
      revenue,
      averageSessionDuration,
    }
  }

  private async getDailyMetrics(startDate: Date, endDate: Date): Promise<DashboardMetrics["dailyMetrics"]> {
    const query = `
      SELECT 
        toDate(timestamp) as date,
        uniq(player_id) as dau,
        uniq(session_id) as sessions,
        sum(CASE WHEN event_type IN ('purchase', 'iap') THEN value ELSE 0 END) as revenue
      FROM analytics_events
      WHERE timestamp BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
      GROUP BY date
      ORDER BY date
    `

    const result = await this.clickHouseService.getEventMetrics(startDate, endDate, ["date"])

    return result.map((row: any) => ({
      date: row.date,
      dau: row.dau || 0,
      sessions: row.sessions || 0,
      revenue: row.revenue || 0,
      retention: 0, // Calculate retention separately
    }))
  }

  private async getTopEvents(startDate: Date, endDate: Date): Promise<DashboardMetrics["topEvents"]> {
    const result = await this.clickHouseService.getEventMetrics(startDate, endDate, ["event_type"])

    return result.map((row: any) => ({
      eventType: row.event_type,
      count: row.events_count,
      uniqueUsers: row.unique_players,
    }))
  }

  private async getPlatformBreakdown(startDate: Date, endDate: Date): Promise<DashboardMetrics["platformBreakdown"]> {
    const result = await this.clickHouseService.getEventMetrics(startDate, endDate, ["platform"])

    const totalUsers = result.reduce((sum, row) => sum + row.unique_players, 0)

    return result.map((row: any) => ({
      platform: row.platform || "unknown",
      users: row.unique_players,
      percentage: totalUsers > 0 ? (row.unique_players / totalUsers) * 100 : 0,
    }))
  }
}
