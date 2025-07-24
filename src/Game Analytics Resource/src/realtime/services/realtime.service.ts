import { Injectable, Logger } from "@nestjs/common"
import type Redis from "ioredis"
import type { EventsService } from "../../events/services/events.service"

@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name)

  constructor(
    private readonly redis: Redis,
    private readonly eventsService: EventsService,
  ) {
    this.initializeStreams()
  }

  private async initializeStreams(): Promise<void> {
    try {
      // Create Redis streams for real-time processing
      await this.redis.xgroup("CREATE", "analytics:events", "processors", "$", "MKSTREAM")
      await this.redis.xgroup("CREATE", "analytics:metrics", "aggregators", "$", "MKSTREAM")

      this.logger.log("Redis streams initialized")
      this.startStreamProcessing()
    } catch (error) {
      if (!error.message.includes("BUSYGROUP")) {
        this.logger.error("Failed to initialize Redis streams", error)
      }
    }
  }

  private startStreamProcessing(): void {
    // Process analytics events stream
    this.processAnalyticsStream()

    // Process metrics stream
    this.processMetricsStream()
  }

  private async processAnalyticsStream(): Promise<void> {
    while (true) {
      try {
        const messages = await this.redis.xreadgroup(
          "GROUP",
          "processors",
          "processor-1",
          "COUNT",
          "10",
          "BLOCK",
          "1000",
          "STREAMS",
          "analytics:events",
          ">",
        )

        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [messageId, fields] of streamMessages) {
              await this.processAnalyticsMessage(messageId, fields)
              await this.redis.xack("analytics:events", "processors", messageId)
            }
          }
        }
      } catch (error) {
        this.logger.error("Error processing analytics stream", error)
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  private async processMetricsStream(): Promise<void> {
    while (true) {
      try {
        const messages = await this.redis.xreadgroup(
          "GROUP",
          "aggregators",
          "aggregator-1",
          "COUNT",
          "10",
          "BLOCK",
          "1000",
          "STREAMS",
          "analytics:metrics",
          ">",
        )

        if (messages && messages.length > 0) {
          for (const [stream, streamMessages] of messages) {
            for (const [messageId, fields] of streamMessages) {
              await this.processMetricsMessage(messageId, fields)
              await this.redis.xack("analytics:metrics", "aggregators", messageId)
            }
          }
        }
      } catch (error) {
        this.logger.error("Error processing metrics stream", error)
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
  }

  async publishAnalyticsEvent(event: any): Promise<void> {
    const streamData = [
      "playerId",
      event.playerId,
      "eventType",
      event.eventType,
      "eventData",
      JSON.stringify(event.eventData),
      "timestamp",
      event.timestamp,
      "value",
      event.value?.toString() || "0",
    ]

    await this.redis.xadd("analytics:events", "*", ...streamData)
  }

  async publishMetric(metric: any): Promise<void> {
    const streamData = [
      "name",
      metric.name,
      "type",
      metric.type,
      "value",
      metric.value.toString(),
      "labels",
      JSON.stringify(metric.labels || {}),
      "timestamp",
      Date.now().toString(),
    ]

    await this.redis.xadd("analytics:metrics", "*", ...streamData)
  }

  private async processAnalyticsMessage(messageId: string, fields: string[]): Promise<void> {
    try {
      const event = this.parseStreamMessage(fields)

      // Real-time aggregations
      await this.updateRealTimeAggregations(event)

      // Trigger alerts if needed
      await this.checkAlerts(event)

      this.logger.debug(`Processed analytics event: ${event.eventType}`)
    } catch (error) {
      this.logger.error(`Failed to process analytics message ${messageId}`, error)
    }
  }

  private async processMetricsMessage(messageId: string, fields: string[]): Promise<void> {
    try {
      const metric = this.parseStreamMessage(fields)

      // Update real-time dashboards
      await this.updateDashboards(metric)

      this.logger.debug(`Processed metric: ${metric.name}`)
    } catch (error) {
      this.logger.error(`Failed to process metrics message ${messageId}`, error)
    }
  }

  private parseStreamMessage(fields: string[]): any {
    const result: any = {}
    for (let i = 0; i < fields.length; i += 2) {
      const key = fields[i]
      const value = fields[i + 1]

      if (key === "eventData" || key === "labels") {
        try {
          result[key] = JSON.parse(value)
        } catch {
          result[key] = value
        }
      } else if (key === "value" || key === "timestamp") {
        result[key] = Number.parseFloat(value)
      } else {
        result[key] = value
      }
    }
    return result
  }

  private async updateRealTimeAggregations(event: any): Promise<void> {
    const now = Date.now()
    const minute = Math.floor(now / 60000) * 60000
    const hour = Math.floor(now / 3600000) * 3600000

    // Update minute-level aggregations
    const minuteKey = `agg:minute:${minute}:${event.eventType}`
    await this.redis.hincrby(minuteKey, "count", 1)
    await this.redis.hincrbyfloat(minuteKey, "value", event.value || 0)
    await this.redis.expire(minuteKey, 3600) // 1 hour TTL

    // Update hour-level aggregations
    const hourKey = `agg:hour:${hour}:${event.eventType}`
    await this.redis.hincrby(hourKey, "count", 1)
    await this.redis.hincrbyfloat(hourKey, "value", event.value || 0)
    await this.redis.expire(hourKey, 86400) // 24 hours TTL

    // Update player-specific metrics
    const playerKey = `player:${event.playerId}:current`
    await this.redis.hincrby(playerKey, "events", 1)
    await this.redis.hset(playerKey, "lastActivity", now)
    await this.redis.expire(playerKey, 86400)
  }

  private async checkAlerts(event: any): Promise<void> {
    // Check for anomalies or threshold breaches
    if (event.eventType === "error" || event.eventType === "crash") {
      await this.triggerAlert("error_spike", {
        eventType: event.eventType,
        playerId: event.playerId,
        timestamp: event.timestamp,
      })
    }

    // Check revenue thresholds
    if (event.eventType === "purchase" && event.value > 100) {
      await this.triggerAlert("high_value_purchase", {
        playerId: event.playerId,
        value: event.value,
        timestamp: event.timestamp,
      })
    }
  }

  private async updateDashboards(metric: any): Promise<void> {
    // Update real-time dashboard data
    const dashboardKey = `dashboard:realtime:${metric.name}`
    await this.redis.zadd(
      dashboardKey,
      Date.now(),
      JSON.stringify({
        value: metric.value,
        timestamp: metric.timestamp,
        labels: metric.labels,
      }),
    )

    // Keep only last 1000 data points
    await this.redis.zremrangebyrank(dashboardKey, 0, -1001)
    await this.redis.expire(dashboardKey, 3600)
  }

  private async triggerAlert(alertType: string, data: any): Promise<void> {
    await this.eventsService.publishEvent(`alert.${alertType}`, {
      alertType,
      data,
      timestamp: Date.now(),
    })

    this.logger.warn(`Alert triggered: ${alertType}`, data)
  }

  async getRealTimeMetrics(metricName: string, timeRange = 3600000): Promise<any[]> {
    const now = Date.now()
    const startTime = now - timeRange

    const dashboardKey = `dashboard:realtime:${metricName}`
    const data = await this.redis.zrangebyscore(dashboardKey, startTime, now, "WITHSCORES")

    const metrics = []
    for (let i = 0; i < data.length; i += 2) {
      try {
        const value = JSON.parse(data[i])
        const timestamp = Number.parseInt(data[i + 1])
        metrics.push({ ...value, timestamp })
      } catch (error) {
        this.logger.error("Failed to parse real-time metric", error)
      }
    }

    return metrics
  }

  async getActiveUsers(): Promise<number> {
    const fiveMinutesAgo = Date.now() - 300000
    const keys = await this.redis.keys("player:*:current")

    let activeCount = 0
    for (const key of keys) {
      const lastActivity = await this.redis.hget(key, "lastActivity")
      if (lastActivity && Number.parseInt(lastActivity) > fiveMinutesAgo) {
        activeCount++
      }
    }

    return activeCount
  }
}
