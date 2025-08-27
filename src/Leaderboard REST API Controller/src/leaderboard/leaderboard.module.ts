import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LeaderboardController } from "./controllers/leaderboard.controller";
import { LeaderboardService } from "./services/leaderboard.service";
import { LeaderboardHistoryService } from "./services/leaderboard-history.service";
import { LeaderboardEntryEntity } from "./entities/leaderboard-entry.entity";
import { LeaderboardHistoryEntity } from "./entities/leaderboard-history.entity";
import { User } from "../users/entities/user.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LeaderboardEntryEntity,
      LeaderboardHistoryEntity,
      User,
    ]),
  ],
  controllers: [LeaderboardController],
  providers: [LeaderboardService, LeaderboardHistoryService],
  exports: [LeaderboardService, LeaderboardHistoryService],
})
export class LeaderboardModule {}
