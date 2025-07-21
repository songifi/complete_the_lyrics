import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FlaggedLyrics } from './entities/flagged-lyrics.entity';
import { FlaggedLyricsService } from './services/flagged-lyrics.service';
import { FlaggedLyricsController } from './controllers/flagged-lyrics.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FlaggedLyrics])],
  controllers: [FlaggedLyricsController],
  providers: [FlaggedLyricsService],
  exports: [FlaggedLyricsService],
})
export class FlaggedLyricsModule {}
