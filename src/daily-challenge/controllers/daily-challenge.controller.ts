import { Controller, Get, Post, Body, Param, UsePipes } from '@nestjs/common';
import { DailyChallengeService } from '../services/daily-challenge.service';
import { ProgressValidationPipe } from '../pipes/progress-validation.pipe';

@Controller('daily-challenge')
export class DailyChallengeController {
  constructor(private readonly dailyChallengeService: DailyChallengeService) {}

  @Get('current')
  async getCurrentChallenge() {
    const today = new Date().toISOString().slice(0, 10);
    // Find today's challenge
    // This assumes only one challenge per day (enforced by unique index)
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
    return { message: 'Progress submitted', userId, progress };
  }
} 