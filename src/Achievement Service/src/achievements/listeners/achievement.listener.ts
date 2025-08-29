import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AchievementsService } from '../achievements.service';
import { AchievementAnalyticsService } from '../services/achievement-analytics.service';

@Injectable()
export class AchievementListener {
  constructor(
    private achievementsService: AchievementsService,
    private analyticsService: AchievementAnalyticsService,
  ) {}

  @OnEvent('achievement.unlock')
  async handleAchievementUnlock(payload: { userId: string; achievementId: string }) {
    const { userId, achievementId } = payload;
    
    // Unlock the achievement
    await this.achievementsService.unlockAchievement(userId, achievementId);
    
    // Track analytics
    await this.analyticsService.trackAchievementUnlock(userId, achievementId);
  }

  @OnEvent('user.action')
  async handleUserAction(payload: { userId: string; action: string; category?: string; value?: number }) {
    // This listener can be used to automatically track progress
    // when users perform actions throughout the application
    const progressService = new (await import('../services/achievement-progress.service')).AchievementProgressService;
    // Note: In a real implementation, you'd inject this service properly
  }
}
