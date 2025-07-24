import { Injectable, Logger } from "@nestjs/common"
import { ClickHouse } from "clickhouse"
import type { AnalyticsEvent } from "./analytics.service"

@Injectable()
export class ClickHouseService {
  private readonly logger = new Logger(ClickHouseService.name)
  private readonly clickhouse: ClickHouse

  constructor() {
    this.clickhouse = new ClickHouse({
      url: process.env.CLICKHOUSE_URL || "http://localhost:8123",
      port: Number.parseInt(process.env.CLICKHOUSE_PORT) || 8123,
      debug: process.env.NODE_ENV === "development",
      basicAuth: process.env.CLICKHOUSE_AUTH
        ? {
            username: process.env.CLICKHOUSE_USERNAME || "default",
            password: process.env.CLICKHOUSE_PASSWORD || "",
          }
        : null,
      isUseGzip: true,
      format: "json",
    })

    this.initializeTables()
  }

  private async initializeTables() {
    try {
      // Create analytics events table
      await this.clickhouse
        .query(`
        CREATE TABLE IF NOT EXISTS analytics_events (
          id String,
          player_id String,
          session_id String,
          event_type String,
          event_data String,
          value Nullable(Float64),
          level Nullable(String),
          game_mode Nullable(String),
          platform Nullable(String),
          version Nullable(String),
          country Nullable(String),
          device_type Nullable(String),
          duration Nullable(UInt32),
          timestamp DateTime64(3),
          date Date MATERIALIZED toDate(timestamp)
        ) ENGINE = MergeTree()
        PARTITION BY toYYYYMM(date)
        ORDER BY (event_type, player_id, timestamp)
        SETTINGS index_granularity = 8192
      `)
        .toPromise()

      // Create materialized view for real-time aggregations
      await this.clickhouse
        .query(`
        CREATE MATERIALIZED VIEW IF NOT EXISTS analytics_hourly_mv
        TO analytics_hourly_agg
        AS SELECT
          toStartOfHour(timestamp) as hour,
          event_type,
          platform,
          country,
          count() as events_count,
          uniq(player_id) as unique_players,
          avg(value) as avg_value,
          sum(value) as total_value
        FROM analytics_events
        GROUP BY hour, event_type, platform, country
      `)
        .toPromise()

      // Create aggregation table
      await this.clickhouse
        .query(`
        CREATE TABLE IF NOT EXISTS analytics_hourly_agg (
          hour DateTime,
          event_type String,
          platform String,
          country String,
          events_count UInt64,
          unique_players UInt64,
          avg_value Float64,
          total_value Float64
        ) ENGINE = SummingMergeTree()
        ORDER BY (hour, event_type, platform, country)
      `)
        .toPromise()

      this.logger.log("ClickHouse tables initialized successfully")
    } catch (error) {
      this.logger.error("Failed to initialize ClickHouse tables", error)
    }
  }

  async insertEvent(event: AnalyticsEvent): Promise<void> {
    try {
      const data = {
        id: require("uuid").v4(),
        player_id: event.playerId,
        session_id: event.sessionId,
        event_type: event.eventType,
        event_data: JSON.stringify(event.eventData),
        value: event.value || null,
        level: event.level || null,
        game_mode: event.gameMode || null,
        platform: event.platform || null,
        version: event.version || null,
        country: event.country || null,
        device_type: event.deviceType || null,
        duration: event.duration || null,
        timestamp: new Date().toISOString(),
      }

      await this.clickhouse.insert("INSERT INTO analytics_events", [data]).toPromise()
    } catch (error) {
      this.logger.error("Failed to insert event to ClickHouse", error)
      throw error
    }
  }

  async getEventMetrics(startDate: Date, endDate: Date, groupBy: string[] = ["event_type"]): Promise<any[]> {
    const groupByClause = groupBy.join(", ")
    const selectClause = groupBy.join(", ") + ", "

    const query = `
      SELECT 
        ${selectClause}
        count() as events_count,
        uniq(player_id) as unique_players,
        avg(value) as avg_value,
        sum(value) as total_value
      FROM analytics_events
      WHERE timestamp BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
      GROUP BY ${groupByClause}
      ORDER BY events_count DESC
      LIMIT 100
    `

    const result = await this.clickhouse.query(query).toPromise()
    return result
  }

  async getPlayerFunnel(events: string[], startDate: Date, endDate: Date): Promise<any[]> {
    const eventsStr = events.map((e) => `'${e}'`).join(", ")

    const query = `
      SELECT 
        event_type,
        count() as players_count,
        count() / (SELECT count(DISTINCT player_id) FROM analytics_events 
                   WHERE timestamp BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
                   AND event_type = '${events[0]}') as conversion_rate
      FROM (
        SELECT DISTINCT player_id, event_type
        FROM analytics_events
        WHERE timestamp BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
        AND event_type IN (${eventsStr})
      )
      GROUP BY event_type
      ORDER BY arrayIndexOf([${eventsStr}], event_type)
    `

    const result = await this.clickhouse.query(query).toPromise()
    return result
  }

  async getRetentionCohorts(startDate: Date, endDate: Date): Promise<any[]> {
    const query = `
      SELECT 
        toStartOfWeek(first_seen) as cohort_week,
        dateDiff('week', first_seen, timestamp) as week_number,
        count(DISTINCT player_id) as retained_players
      FROM (
        SELECT 
          player_id,
          timestamp,
          min(timestamp) OVER (PARTITION BY player_id) as first_seen
        FROM analytics_events
        WHERE timestamp BETWEEN '${startDate.toISOString()}' AND '${endDate.toISOString()}'
        AND event_type = 'session_start'
      )
      GROUP BY cohort_week, week_number
      ORDER BY cohort_week, week_number
    `

    const result = await this.clickhouse.query(query).toPromise()
    return result
  }
}
