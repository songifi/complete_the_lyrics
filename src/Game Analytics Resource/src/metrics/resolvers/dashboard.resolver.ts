import { Resolver, Query } from "@nestjs/graphql"
import type { DashboardService, DashboardMetrics } from "../services/dashboard.service"

@Resolver()
export class DashboardResolver {
  constructor(private readonly dashboardService: DashboardService) {}

  @Query(() => Object)
  async getDashboardMetrics(days: number): Promise<DashboardMetrics> {
    return this.dashboardService.getDashboardMetrics(days)
  }
}
