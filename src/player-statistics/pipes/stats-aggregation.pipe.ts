import { PipeTransform, Injectable, ArgumentMetadata, BadRequestException } from '@nestjs/common';

export interface AggregationOptions {
  groupBy?: string[];
  aggregations?: {
    [key: string]: 'sum' | 'avg' | 'min' | 'max' | 'count';
  };
  timeframe?: string;
  filters?: { [key: string]: any };
}

@Injectable()
export class StatsAggregationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata) {
    if (!value || typeof value !== 'object') {
      throw new BadRequestException('Invalid aggregation options');
    }

    const options: AggregationOptions = {
      groupBy: value.groupBy || [],
      aggregations: value.aggregations || {},
      timeframe: value.timeframe || 'all-time',
      filters: value.filters || {}
    };

    // Validate aggregation functions
    const validAggregations = ['sum', 'avg', 'min', 'max', 'count'];
    for (const [field, func] of Object.entries(options.aggregations)) {
      if (!validAggregations.includes(func)) {
        throw new BadRequestException(`Invalid aggregation function: ${func}`);
      }
    }

    return options;
  }
}
