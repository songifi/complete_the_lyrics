import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Get,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { FlaggedLyricsService } from '../services/flagged-lyrics.service';
import { CreateFlagDto } from '../dto/create-flag.dto';
import { FlaggedLyrics } from '../entities/flagged-lyrics.entity';

@Controller('lyrics')
@UseGuards(JwtAuthGuard)
export class FlaggedLyricsController {
  constructor(private readonly flaggedLyricsService: FlaggedLyricsService) {}

  @Post(':id/flag')
  async flagLyrics(
    @Param('id', ParseIntPipe) lyricsId: number,
    @Body() createFlagDto: Omit<CreateFlagDto, 'lyricsId'>,
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string; flagId: number }> {
    const flag = await this.flaggedLyricsService.createFlag(
      { ...createFlagDto, lyricsId },
      userId,
    );

    return {
      message: 'Lyrics flagged successfully',
      flagId: flag.id,
    };
  }

  @Get('my-flags')
  async getMyFlags(
    @CurrentUser('id') userId: string,
  ): Promise<FlaggedLyrics[]> {
    return await this.flaggedLyricsService.getFlagsByUserId(userId);
  }
}
