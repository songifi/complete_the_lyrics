import { Controller, Get } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { ServerMetrics } from './server-metrics.entity';
import { CapacityPlanningService } from './capacity-planning.service';
import { GrafanaDashboardService } from './grafana-dashboard.service';
import { LogAggregationService } from './log-aggregation.service';

@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly capacityPlanningService: CapacityPlanningService,
    private readonly grafanaDashboardService: GrafanaDashboardService,
    private readonly logAggregationService: LogAggregationService,
  ) {}

  @Get()
  getMetrics(): ServerMetrics {
    return this.metricsService.getMetrics();
  }

  @Get('scaling-recommendation')
  getScalingRecommendation(): string {
    return this.capacityPlanningService.getScalingRecommendation();
  }

  @Get('dashboard-url')
  async getDashboardUrl(): Promise<string> {
    return this.grafanaDashboardService.getDashboardUrl();
  }

  @Get('test-log')
  testLog() {
    this.logAggregationService.aggregateLog('Test log message', 'info');
    return { message: 'Log aggregated' };
  }

  @Get('test-error')
  testError() {
    try {
      throw new Error('Test error for tracking');
    } catch (error) {
      this.logAggregationService.trackError(error);
      return { message: 'Error tracked' };
    }
  }
} 