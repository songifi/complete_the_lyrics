import { Module } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { AlertingService } from './alerting.service';
import { CapacityPlanningService } from './capacity-planning.service';
import { GrafanaDashboardService } from './grafana-dashboard.service';
import { LogAggregationService } from './log-aggregation.service';

@Module({
  imports: [],
  providers: [MetricsService, AlertingService, CapacityPlanningService, GrafanaDashboardService, LogAggregationService],
  controllers: [MetricsController],
  exports: [MetricsService, AlertingService, CapacityPlanningService, GrafanaDashboardService, LogAggregationService],
})
export class MetricsModule {} 