import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { FlaggedLyricsModule } from '../flagged-lyrics/flagged-lyrics.module';

@Module({
  imports: [FlaggedLyricsModule],
  controllers: [AdminController],
})
export class AdminModule {}
