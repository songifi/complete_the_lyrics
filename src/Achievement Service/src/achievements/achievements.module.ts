import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';
import { AchievementProgressService } from './services/achievement-progress.service';
import { AchievementNotificationService } from './services/achievement-notification.service';
import { AchievementRewardService } from './services/achievement-reward.service';
import { AchievementAnalyticsService } from './services/achievement-analytics.service';
import { AchievementSharingService } from './services/achievement-sharing.service';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { AchievementProgress } from './entities/achievement-progress.entity';
import { AchievementReward } from './entities/achievement-reward.entity';
import { AchievementAnalytics } from './entities/achievement-analytics.entity';
import { AchievementListener } from './listeners/achievement.listener';
import { AchievementRepository } from './repositories/achievement.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Achievement,
      UserAchievement,
      AchievementProgress,
      AchievementReward,
      AchievementAnalytics,
    ]),
  ],
  controllers: [AchievementsController],
  providers: [
    AchievementsService,
    AchievementProgressService,
    AchievementNotificationService,
    AchievementRewardService,
    AchievementAnalyticsService,
    AchievementSharingService,
    AchievementListener,
    AchievementRepository,
  ],
  exports: [
    AchievementsService,
    AchievementProgressService,
    AchievementNotificationService,
  ],
})
export class AchievementsModule {}