import { SetMetadata } from '@nestjs/common';

export const TRACK_STATS_KEY = 'track_stats';

export interface StatsTrackingOptions {
  category: string;
  metrics: string[];
  weight?: number;
  async?: boolean;
}

export const TrackStats = (options: StatsTrackingOptions) => 
  SetMetadata(TRACK_STATS_KEY, options);

// decorators/performance-metric.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const PERFORMANCE_METRIC_KEY = 'performance_metric';

export interface PerformanceMetricOptions {
  name: string;
  category?: string;
  track?: boolean;
}

export const PerformanceMetric = (options: PerformanceMetricOptions) =>
  SetMetadata(PERFORMANCE_METRIC_KEY, options);