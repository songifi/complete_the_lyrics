import { SetMetadata } from "@nestjs/common"

export const TRACK_METRIC_KEY = "track_metric"

export interface MetricConfig {
  name: string
  type: "counter" | "gauge" | "histogram" | "summary"
  description?: string
  labels?: string[]
  buckets?: number[]
}

export const TrackMetric = (config: MetricConfig) => SetMetadata(TRACK_METRIC_KEY, config)
