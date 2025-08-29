import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { Leaderboard } from './entities/leaderboard.entity';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import { LeaderboardArchive } from './entities/leaderboard-archive.entity';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardRepository } from './repositories/leaderboard.repository';
import { LeaderboardController } from './controllers/leaderboard.controller';
import { LeaderboardGateway } from './gateways/leaderboard.gateway';
import { LeaderboardNotificationService } from './services/leaderboard-notification.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Leaderboard, LeaderboardEntry, LeaderboardArchive]),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot()
  ],
  controllers: [LeaderboardController],
  providers: [
    LeaderboardService,
    LeaderboardRepository,
    LeaderboardGateway,
    LeaderboardNotificationService
  ],
  exports: [LeaderboardService, LeaderboardNotificationService]
})
export class LeaderboardModule {}