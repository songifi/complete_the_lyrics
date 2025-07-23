import { SetMetadata } from '@nestjs/common';

export const CUSTOM_METRIC_KEY = 'customMetric';

export function CustomMetric(metricName: string): MethodDecorator {
  return SetMetadata(CUSTOM_METRIC_KEY, metricName);
} 