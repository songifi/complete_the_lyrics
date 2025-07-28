import { Injectable } from "@nestjs/common"
import Redis from "ioredis"

interface MetricLabels {
  [key: string]: string
}

@Injectable()
export class MetricsService {
  private readonly redis: Redis

  constructor() {
    this.redis = new Redis()
  }

  async incrementCounter(name: string, labels: MetricLabels = {}, value = 1): Promise<void> {
    const key = this.buildMetricKey("counter", name, labels)
    await this.redis.incrby(key, value)
    await this.redis.expire(key, 86400) // 24 hours TTL
  }

  async setGauge(name: string, value: number, labels: MetricLabels = {}): Promise<void> {
    const key = this.buildMetricKey("gauge", name, labels)
    await this.redis.set(key, value)
    await this.redis.expire(key, 86400)
  }

  async recordHistogram(name: string, value: number, labels: MetricLabels = {}): Promise<void> {
    const key = this.buildMetricKey("histogram", name, labels)
    const timestamp = Date.now()

    // Store histogram data points
    await this.redis.zadd(`${key}:values`, timestamp, value)
    await this.redis.expire(`${key}:values`, 86400)

    // Update histogram statistics
    const multi = this.redis.multi()
    multi.hincrby(`${key}:stats`, "count", 1)
    multi.hincrbyfloat(`${key}:stats`, "sum", value)
    multi.expire(`${key}:stats`, 86400)
    await multi.exec()
  }

  async recordSummary(name: string, value: number, labels: MetricLabels = {}): Promise<void> {
    const key = this.buildMetricKey("summary", name, labels)
    const timestamp = Date.now()

    // Store summary data points with sliding window
    await this.redis.zadd(`${key}:values`, timestamp, value)
    await this.redis.zremrangebyscore(`${key}:values`, 0, timestamp - 300000) // Keep last 5 minutes
    await this.redis.expire(`${key}:values`, 86400)
  }

  async getMetrics(name: string, labels: MetricLabels = {}): Promise<any> {
    const pattern = this.buildMetricKey("*", name, labels)
    const keys = await this.redis.keys(pattern)

    const metrics = {}
    for (const key of keys) {
      const [type] = key.split(":")
      const value = await this.getMetricValue(key, type)
      metrics[key] = value
    }

    return metrics
  }

  private async getMetricValue(key: string, type: string): Promise<any> {
    switch (type) {
      case "counter":
      case "gauge":
        return await this.redis.get(key)

      case "histogram":
        const stats = await this.redis.hgetall(`${key}:stats`)
        const values = await this.redis.zrange(`${key}:values`, 0, -1, "WITHSCORES")
        return {
          count: Number.parseInt(stats.count || "0"),
          sum: Number.parseFloat(stats.sum || "0"),
          values: this.parseZRangeResult(values),
        }

      case "summary":
        const summaryValues = await this.redis.zrange(`${key}:values`, 0, -1, "WITHSCORES")
        const parsedValues = this.parseZRangeResult(summaryValues)
        return {
          count: parsedValues.length,
          values: parsedValues,
          quantiles: this.calculateQuantiles(parsedValues.map((v) => v.value)),
        }

      default:
        return null
    }
  }

  private buildMetricKey(type: string, name: string, labels: MetricLabels): string {
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(",")

    return `${type}:${name}${labelStr ? `:${labelStr}` : ""}`
  }

  private parseZRangeResult(result: string[]): Array<{ value: number; timestamp: number }> {
    const parsed = []
    for (let i = 0; i < result.length; i += 2) {
      parsed.push({
        value: Number.parseFloat(result[i]),
        timestamp: Number.parseInt(result[i + 1]),
      })
    }
    return parsed
  }

  private calculateQuantiles(values: number[]): Record<string, number> {
    if (values.length === 0) return {}

    const sorted = values.sort((a, b) => a - b)
    const len = sorted.length

    return {
      p50: sorted[Math.floor(len * 0.5)],
      p90: sorted[Math.floor(len * 0.9)],
      p95: sorted[Math.floor(len * 0.95)],
      p99: sorted[Math.floor(len * 0.99)],
    }
  }
}
