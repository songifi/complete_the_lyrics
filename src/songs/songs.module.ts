import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SongsService } from "./songs.service";
import { SongsController } from "./songs.controller";
import { Song } from "../GameRound/entities/song.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Song])],
  controllers: [SongsController],
  providers: [SongsService],
  exports: [SongsService],
})
export class SongsModule {}


