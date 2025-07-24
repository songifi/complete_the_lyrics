import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { ABTest } from "./entities/ab-test.entity"
import { ABTestAssignment } from "./entities/ab-test-assignment.entity"
import { ABTestingService } from "./services/ab-testing.service"
import { AnalyticsModule } from "../analytics/analytics.module"
import { EventsModule } from "../events/events.module"

@Module({
  imports: [TypeOrmModule.forFeature([ABTest, ABTestAssignment]), AnalyticsModule, EventsModule],
  providers: [ABTestingService],
  exports: [ABTestingService],
})
export class ABTestingModule {}
