import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { FlaggedLyricsService } from '../flagged-lyrics/services/flagged-lyrics.service';
import { ResolveFlagDto } from '../flagged-lyrics/dto/resolve-flag.dto';
import { FlaggedLyricsResponseDto } from '../flagged-lyrics/dto/flagged-lyrics-response.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(
    private readonly flaggedLyricsService: FlaggedLyricsService,
  ) {}

  @Get('flags')
  async getAllFlags(
    @Query('status') status?: string,
  ): Promise<FlaggedLyricsResponseDto[]> {
    // If status is 'pending', get only pending flags, otherwise get all
    if (status === 'pending') {
      return await this.flaggedLyricsService.getPendingFlags();
    }
    return await this.flaggedLyricsService.getAllFlags();
  }

  @Patch('flags/:id/resolve')
  async resolveFlag(
    @Param('id', ParseIntPipe) id: number,
    @Body() resolveFlagDto: ResolveFlagDto,
    @CurrentUser('id') adminUserId: string,
  ): Promise<FlaggedLyricsResponseDto> {
    return await this.flaggedLyricsService.resolveFlag(
      id,
      resolveFlagDto,
      adminUserId,
    );
  }
} 