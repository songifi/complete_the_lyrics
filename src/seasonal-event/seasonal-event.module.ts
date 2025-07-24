import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from '@nestjs/redis';
import { SeasonalEvent } from './entities/seasonal-event.entity';
import { SeasonalEventService } from './services/seasonal-event.service';
import { SeasonalEventController } from './controllers/seasonal-event.controller';
import { SeasonalEventGateway } from './gateways/seasonal-event.gateway';
import { SeasonalEventAnalyticsService } from './services/seasonal-event-analytics.service';
import { EventAccessGuard } from './guards/event-access.guard';
import { RewardCalculationPipe } from './pipes/reward-calculation.pipe';
import { SeasonalEventRewardProcessor } from './processors/seasonal-event-reward.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([SeasonalEvent]),
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: 'seasonal-event-reward' }),
    RedisModule,
  ],
  providers: [
    SeasonalEventService,
    SeasonalEventGateway,
    SeasonalEventAnalyticsService,
    EventAccessGuard,
    RewardCalculationPipe,
    SeasonalEventRewardProcessor,
  ],
  controllers: [SeasonalEventController],
  exports: [SeasonalEventService],
})
export class SeasonalEventModule {} 