import { Module } from "@nestjs/common"
import { DashboardService } from "./services/dashboard.service"
import { DashboardResolver } from "./resolvers/dashboard.resolver"
import { AnalyticsModule } from "../analytics/analytics.module"

@Module({
  imports: [AnalyticsModule],
  providers: [DashboardService, DashboardResolver],
  exports: [DashboardService],
})
export class MetricsModule {}
