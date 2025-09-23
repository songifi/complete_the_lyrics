import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SongsService } from "./songs.service";
import { SongsController } from "./songs.controller";
import { SearchService } from "./search.service";
import { SearchController } from "./search.controller";
import { PopularityService } from "./popularity.service";
import { CacheService } from "./cache.service";
import { Song } from "../GameRound/entities/song.entity";
import { SearchAnalytics } from "./entities/search-analytics.entity";
import { SearchSuggestion } from "./entities/search-suggestion.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Song, SearchAnalytics, SearchSuggestion]),
  ],
  controllers: [SongsController, SearchController],
  providers: [SongsService, SearchService, PopularityService, CacheService],
  exports: [SongsService, SearchService, PopularityService, CacheService],
})
export class SongsModule {}


