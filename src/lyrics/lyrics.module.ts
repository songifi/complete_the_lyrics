import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Lyrics } from './entities/lyrics.entity';
import { LyricsService } from './services/lyrics.service';
import { LyricsController } from './controllers/lyrics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Lyrics])],
  providers: [LyricsService],
  exports: [LyricsService],
  controllers: [LyricsController],
})
export class LyricsModule {}
