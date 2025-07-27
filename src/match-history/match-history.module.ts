import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { CacheModule } from "@nestjs/cache-manager"
import { MatchHistoryService } from "./services/match-history.service"
import { MatchHistoryController } from "./controllers/match-history.controller"
import { MatchHistory } from "./entities/match-history.entity"
import { MatchCacheService } from "./services/match-cache.service"

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchHistory]),
    CacheModule.register(), // Configured globally in app.module or here with specific options
  ],
  controllers: [MatchHistoryController],
  providers: [MatchHistoryService, MatchCacheService],
  exports: [MatchHistoryService, MatchCacheService],
})
export class MatchHistoryModule {}
