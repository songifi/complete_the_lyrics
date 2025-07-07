import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { UserStatsService } from '../services/user-stats.service';
import { UserStats } from '../entities/user-stats.entity';
import { LeaderboardEntry } from '../services/user-stats.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';

@Controller('users')
export class UserStatsController {
  constructor(private readonly userStatsService: UserStatsService) {}

  @Get('stats/:userId')
  @UseGuards(JwtAuthGuard)
  async getUserStats(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<UserStats> {
    return await this.userStatsService.findByUserId(userId);
  }

  @Get('leaderboard')
  // Note: Leaderboard can be public, but you can add @UseGuards(JwtAuthGuard) if needed
  async getLeaderboard(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<LeaderboardEntry[]> {
    // Ensure limit is within reasonable bounds
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return await this.userStatsService.getLeaderboard(safeLimit);
  }

  @Get('stats/:userId/rank')
  @UseGuards(JwtAuthGuard)
  async getUserRank(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<{ rank: number }> {
    const rank = await this.userStatsService.getUserRank(userId);
    return { rank };
  }

  @Get('my-stats')
  @UseGuards(JwtAuthGuard)
  async getMyStats(@CurrentUser('id') userId: string): Promise<UserStats> {
    return await this.userStatsService.findByUserId(Number(userId));
  }
}
