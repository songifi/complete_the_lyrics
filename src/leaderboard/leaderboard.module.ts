import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Leaderboard } from './entities/leaderboard.entity';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import { LeaderboardArchive } from './entities/leaderboard-archive.entity';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardRepository } from './repositories/leaderboard.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([Leaderboard, LeaderboardEntry, LeaderboardArchive])
  ],
  providers: [LeaderboardService, LeaderboardRepository],
  exports: [LeaderboardService]
})
export class LeaderboardModule {}