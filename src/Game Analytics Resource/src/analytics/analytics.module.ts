import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { APP_INTERCEPTOR } from "@nestjs/core"

import { GameAnalytics } from "./entities/game-analytics.entity"
import { PlayerSession } from "./entities/player-session.entity"
import { AnalyticsService } from "./services/analytics.service"
import { ClickHouseService } from "./services/clickhouse.service"
import { MetricsService } from "./services/metrics.service"
import { AnalyticsResolver } from "./resolvers/analytics.resolver"
import { MetricsInterceptor } from "./interceptors/metrics.interceptor"
import { EventsModule } from "../events/events.module"

@Module({
  imports: [TypeOrmModule.forFeature([GameAnalytics, PlayerSession]), EventsModule],
  providers: [
    AnalyticsService,
    ClickHouseService,
    MetricsService,
    AnalyticsResolver,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
  exports: [AnalyticsService, ClickHouseService, MetricsService],
})
export class AnalyticsModule {}
