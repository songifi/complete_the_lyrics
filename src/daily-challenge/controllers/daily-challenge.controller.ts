import { Controller, Get, Post, Body, Param, UsePipes } from '@nestjs/common';
import { DailyChallengeService } from '../services/daily-challenge.service';
import { ProgressValidationPipe } from '../pipes/progress-validation.pipe';
import { DailyChallengeAnalyticsService } from '../services/daily-challenge-analytics.service';

@Controller('daily-challenge')
export class DailyChallengeController {
  constructor(
    private readonly dailyChallengeService: DailyChallengeService,
    private readonly analyticsService: DailyChallengeAnalyticsService,
  ) {}

  @Get('current')
  async getCurrentChallenge() {
    const today = new Date().toISOString().slice(0, 10);
    const challenge = await this.dailyChallengeService['dailyChallengeRepo'].findOne({ where: { date: today } });
    if (!challenge) {
      return { message: 'No challenge for today yet.' };
    }
    return challenge;
  }

  @Post('progress/:userId')
  @UsePipes(ProgressValidationPipe)
  async submitProgress(@Param('userId') userId: string, @Body() progress: any) {
    await this.dailyChallengeService.trackProgress(userId, progress);
    const today = new Date().toISOString().slice(0, 10);
    await this.analyticsService.trackParticipation(userId, today);
    return { message: 'Progress submitted', userId, progress };
  }

  @Post('complete/:userId')
  async completeChallenge(@Param('userId') userId: string) {
    const today = new Date().toISOString().slice(0, 10);
    await this.analyticsService.trackCompletion(userId, today);
    return { message: 'Completion tracked', userId };
  }

  @Post('share/:userId')
  async shareChallenge(@Param('userId') userId: string) {
    const today = new Date().toISOString().slice(0, 10);
    await this.analyticsService.trackShare(userId, today);
    return { message: 'Share tracked', userId };
  }

  @Get('metrics')
  async getMetrics() {
    const today = new Date().toISOString().slice(0, 10);
    return this.analyticsService.getMetrics(today);
  }
} 