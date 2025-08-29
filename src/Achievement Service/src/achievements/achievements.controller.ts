import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AchievementsService } from './achievements.service';
import { AchievementProgressService } from './services/achievement-progress.service';
import { AchievementSharingService } from './services/achievement-sharing.service';
import { AchievementAnalyticsService } from './services/achievement-analytics.service';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { ShareAchievementDto } from './dto/share-achievement.dto';
import { GetAchievementsQueryDto } from './dto/get-achievements-query.dto';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('achievements')
@UseGuards(JwtAuthGuard)
export class AchievementsController {
  constructor(
    private readonly achievementsService: AchievementsService,
    private readonly progressService: AchievementProgressService,
    private readonly sharingService: AchievementSharingService,
    private readonly analyticsService: AchievementAnalyticsService,
  ) {}

  @Get()
  async getUserAchievements(
    @GetUser('id') userId: string,
    @Query() query: GetAchievementsQueryDto,
  ) {
    return this.achievementsService.getUserAchievements(userId, query);
  }

  @Get('available')
  async getAvailableAchievements(@GetUser('id') userId: string) {
    return this.achievementsService.getAvailableAchievements(userId);
  }

  @Get('progress')
  async getUserProgress(@GetUser('id') userId: string) {
    return this.progressService.getUserProgress(userId);
  }

  @Post('progress')
  async updateProgress(
    @GetUser('id') userId: string,
    @Body() updateProgressDto: UpdateProgressDto,
  ) {
    return this.progressService.updateProgress(userId, updateProgressDto);
  }

  @Get('leaderboard')
  async getLeaderboard(@Query('category') category?: string) {
    return this.achievementsService.getLeaderboard(category);
  }

  @Post(':id/share')
  async shareAchievement(
    @GetUser('id') userId: string,
    @Param('id') achievementId: string,
    @Body() shareDto: ShareAchievementDto,
  ) {
    return this.sharingService.shareAchievement(userId, achievementId, shareDto);
  }

  @Get('analytics')
  async getAchievementAnalytics(@GetUser('id') userId: string) {
    return this.analyticsService.getUserAnalytics(userId);
  }

  @Get('rewards/claim')
  async getUnclaimedRewards(@GetUser('id') userId: string) {
    return this.achievementsService.getUnclaimedRewards(userId);
  }

  @Patch('rewards/:rewardId/claim')
  async claimReward(
    @GetUser('id') userId: string,
    @Param('rewardId') rewardId: string,
  ) {
    return this.achievementsService.claimReward(userId, rewardId);
  }
}
