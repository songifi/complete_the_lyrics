import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { PlayerBehavior } from "./entities/player-behavior.entity"
import { BehaviorAnalysisService } from "./services/behavior-analysis.service"
import { AnalyticsModule } from "../analytics/analytics.module"

@Module({
  imports: [TypeOrmModule.forFeature([PlayerBehavior]), AnalyticsModule],
  providers: [BehaviorAnalysisService],
  exports: [BehaviorAnalysisService],
})
export class PlayerModule {}
