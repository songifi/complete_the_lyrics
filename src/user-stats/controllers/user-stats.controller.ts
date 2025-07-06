import { Controller, Get, Param, Query, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { UserStatsService } from '../services/user-stats.service';
import { UserStats } from '../entities/user-stats.entity';
import { LeaderboardEntry } from '../services/user-stats.service';

@Controller('users')
export class UserStatsController {
  constructor(private readonly userStatsService: UserStatsService) {}

  @Get('stats/:userId')
  async getUserStats(@Param('userId', ParseIntPipe) userId: number): Promise<UserStats> {
    return await this.userStatsService.findByUserId(userId);
  }

  @Get('leaderboard')
  async getLeaderboard(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ): Promise<LeaderboardEntry[]> {
    // Ensure limit is within reasonable bounds
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return await this.userStatsService.getLeaderboard(safeLimit);
  }

  @Get('stats/:userId/rank')
  async getUserRank(@Param('userId', ParseIntPipe) userId: number): Promise<{ rank: number }> {
    const rank = await this.userStatsService.getUserRank(userId);
    return { rank };
  }
}