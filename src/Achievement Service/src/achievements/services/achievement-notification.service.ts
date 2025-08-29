import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Achievement } from '../entities/achievement.entity';

export interface NotificationPayload {
  userId: string;
  title: string;
  message: string;
  type: 'achievement_unlocked' | 'progress_update' | 'reward_available';
  data?: any;
  imageUrl?: string;
}

@Injectable()
export class AchievementNotificationService {
  constructor(private eventEmitter: EventEmitter2) {}

  async sendAchievementUnlockedNotification(
    userId: string,
    achievement: Achievement,
  ) {
    const notification: NotificationPayload = {
      userId,
      title: ' Achievement Unlocked!',
      message: `Congratulations! You've earned "${achievement.name}"`,
      type: 'achievement_unlocked',
      imageUrl: achievement.imageUrl,
      data: {
        achievementId: achievement.id,
        points: achievement.points,
        category: achievement.category,
      },
    };

    // Emit notification event
    this.eventEmitter.emit('notification.send', notification);

    // Store notification in database (optional)
    await this.storeNotification(notification);

    return notification;
  }

  async sendProgressUpdateNotification(
    userId: string,
    achievement: Achievement,
    currentProgress: number,
    targetProgress: number,
  ) {
    const percentage = Math.floor((currentProgress / targetProgress) * 100);
    
    // Only send notifications at significant milestones
    if (percentage % 25 === 0 && percentage > 0 && percentage < 100) {
      const notification: NotificationPayload = {
        userId,
        title: ' Progress Update',
        message: `You're ${percentage}% of the way to "${achievement.name}"`,
        type: 'progress_update',
        data: {
          achievementId: achievement.id,
          progress: currentProgress,
          target: targetProgress,
          percentage,
        },
      };

      this.eventEmitter.emit('notification.send', notification);
      await this.storeNotification(notification);
    }
  }

  async sendRewardAvailableNotification(userId: string, rewardCount: number) {
    const notification: NotificationPayload = {
      userId,
      title: ' Rewards Available',
      message: `You have ${rewardCount} unclaimed reward${rewardCount > 1 ? 's' : ''}!`,
      type: 'reward_available',
      data: { rewardCount },
    };

    this.eventEmitter.emit('notification.send', notification);
    await this.storeNotification(notification);
  }

  private async storeNotification(notification: NotificationPayload) {
    // Store in database for notification history
    // Implementation depends on your notification entity structure
    console.log('Storing notification:', notification);
  }

  async getNotificationHistory(userId: string, limit = 50) {
    // Retrieve notification history from database
    // Implementation depends on your notification entity structure
    return [];
  }
}