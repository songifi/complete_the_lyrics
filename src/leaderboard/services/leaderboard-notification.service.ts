import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { LeaderboardType, LeaderboardPeriod } from '../entities/leaderboard.entity';

interface RankChangeEvent {
  userId: string;
  oldRank: number | null;
  newRank: number;
  leaderboardId: string;
  type: LeaderboardType;
  period: LeaderboardPeriod;
  category: string;
  score: number;
}

interface LeaderboardResetEvent {
  leaderboardId: string;
  type: LeaderboardType;
  period: LeaderboardPeriod;
  category: string;
  resetAt: Date;
}

interface NotificationTemplate {
  title: string;
  body: string;
  type: 'rank_up' | 'rank_down' | 'new_rank' | 'milestone' | 'reset';
  priority: 'low' | 'medium' | 'high';
}

@Injectable()
export class LeaderboardNotificationService {
  private readonly logger = new Logger(LeaderboardNotificationService.name);

  // This would typically integrate with your notification system
  // For now, we'll log the notifications and emit events
  
  @OnEvent('leaderboard.rank.changed')
  async handleRankChange(event: RankChangeEvent): Promise<void> {
    try {
      const notification = this.createRankChangeNotification(event);
      
      // Send notification (implement your notification logic here)
      await this.sendNotification(event.userId, notification);
      
      // Check for milestone achievements
      await this.checkMilestoneAchievements(event);
      
      this.logger.log(`Sent rank change notification to user ${event.userId}: ${event.oldRank} -> ${event.newRank}`);
    } catch (error) {
      this.logger.error(`Failed to send rank change notification: ${error.message}`);
    }
  }

  @OnEvent('leaderboard.reset')
  async handleLeaderboardReset(event: LeaderboardResetEvent): Promise<void> {
    try {
      // This would typically notify all users who were on the leaderboard
      // For now, we'll just log the reset event
      this.logger.log(`Leaderboard reset: ${event.type} ${event.period} ${event.category}`);
      
      // You could implement logic here to:
      // 1. Get all users from the archived leaderboard
      // 2. Send them notifications about the reset
      // 3. Inform them about the new season starting
      
    } catch (error) {
      this.logger.error(`Failed to handle leaderboard reset notification: ${error.message}`);
    }
  }

  private createRankChangeNotification(event: RankChangeEvent): NotificationTemplate {
    const { oldRank, newRank, type, period, category, score } = event;
    
    // Format the leaderboard name
    const leaderboardName = this.formatLeaderboardName(type, period, category);
    
    if (oldRank === null) {
      // First time on leaderboard
      return {
        title: `Welcome to the ${leaderboardName} Leaderboard!`,
        body: `You've entered the leaderboard at rank #${newRank} with ${score} points!`,
        type: 'new_rank',
        priority: 'medium'
      };
    }
    
    if (newRank < oldRank) {
      // Rank improved
      const improvement = oldRank - newRank;
      return {
        title: `🎉 Rank Up!`,
        body: `You've climbed ${improvement} position${improvement > 1 ? 's' : ''} to rank #${newRank} on the ${leaderboardName} leaderboard!`,
        type: 'rank_up',
        priority: newRank <= 10 ? 'high' : 'medium'
      };
    } else {
      // Rank decreased
      const decrease = newRank - oldRank;
      return {
        title: `Rank Update`,
        body: `Your rank on the ${leaderboardName} leaderboard has changed to #${newRank}`,
        type: 'rank_down',
        priority: 'low'
      };
    }
  }

  private async checkMilestoneAchievements(event: RankChangeEvent): Promise<void> {
    const { userId, newRank, type, period, category, score } = event;
    const milestones: NotificationTemplate[] = [];

    // Top 10 achievement
    if (newRank <= 10 && (event.oldRank === null || event.oldRank > 10)) {
      milestones.push({
        title: `🏆 Top 10 Achievement!`,
        body: `Congratulations! You've reached the top 10 on the ${this.formatLeaderboardName(type, period, category)} leaderboard!`,
        type: 'milestone',
        priority: 'high'
      });
    }

    // Top 3 achievement
    if (newRank <= 3 && (event.oldRank === null || event.oldRank > 3)) {
      milestones.push({
        title: `🥉🥈🥇 Podium Finish!`,
        body: `Amazing! You've reached the podium at rank #${newRank}!`,
        type: 'milestone',
        priority: 'high'
      });
    }

    // #1 achievement
    if (newRank === 1 && event.oldRank !== 1) {
      milestones.push({
        title: `👑 Leaderboard Champion!`,
        body: `Incredible! You're now #1 on the ${this.formatLeaderboardName(type, period, category)} leaderboard!`,
        type: 'milestone',
        priority: 'high'
      });
    }

    // Score milestones (customize based on your game)
    const scoreMilestones = [1000, 5000, 10000, 25000, 50000, 100000];
    for (const milestone of scoreMilestones) {
      if (score >= milestone && (event.oldRank === null || score - milestone < 100)) {
        milestones.push({
          title: `🎯 Score Milestone!`,
          body: `You've reached ${milestone.toLocaleString()} points! Keep going!`,
          type: 'milestone',
          priority: 'medium'
        });
      }
    }

    // Send all milestone notifications
    for (const milestone of milestones) {
      await this.sendNotification(userId, milestone);
    }
  }

  private formatLeaderboardName(type: LeaderboardType, period: LeaderboardPeriod, category: string): string {
    const typeNames = {
      [LeaderboardType.GLOBAL]: 'Global',
      [LeaderboardType.FRIENDS]: 'Friends',
      [LeaderboardType.SEASONAL]: 'Seasonal'
    };

    const periodNames = {
      [LeaderboardPeriod.DAILY]: 'Daily',
      [LeaderboardPeriod.WEEKLY]: 'Weekly',
      [LeaderboardPeriod.MONTHLY]: 'Monthly',
      [LeaderboardPeriod.ALL_TIME]: 'All-Time'
    };

    return `${typeNames[type]} ${periodNames[period]} ${category}`;
  }

  private async sendNotification(userId: string, notification: NotificationTemplate): Promise<void> {
    // This is where you would integrate with your notification system
    // Examples:
    // - Push notifications (Firebase, OneSignal, etc.)
    // - Email notifications
    // - In-app notifications
    // - WebSocket notifications
    
    // For now, we'll log the notification and could emit an event
    this.logger.log(`Notification for user ${userId}: ${notification.title} - ${notification.body}`);
    
    // You could emit an event that other services can listen to
    // this.eventEmitter.emit('notification.send', {
    //   userId,
    //   notification,
    //   timestamp: new Date()
    // });
  }

  // Utility method to create custom notifications
  async sendCustomNotification(
    userId: string,
    title: string,
    body: string,
    type: NotificationTemplate['type'] = 'milestone',
    priority: NotificationTemplate['priority'] = 'medium'
  ): Promise<void> {
    const notification: NotificationTemplate = {
      title,
      body,
      type,
      priority
    };

    await this.sendNotification(userId, notification);
  }

  // Method to send notifications to multiple users (e.g., for leaderboard resets)
  async sendBulkNotification(
    userIds: string[],
    notification: NotificationTemplate
  ): Promise<void> {
    const promises = userIds.map(userId => this.sendNotification(userId, notification));
    await Promise.allSettled(promises);
    
    this.logger.log(`Sent bulk notification to ${userIds.length} users: ${notification.title}`);
  }

  // Method to create and send season end notifications
  async sendSeasonEndNotifications(
    finalRankings: Array<{ userId: string; rank: number; score: number }>,
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string
  ): Promise<void> {
    const leaderboardName = this.formatLeaderboardName(type, period, category);
    
    for (const ranking of finalRankings) {
      let notification: NotificationTemplate;
      
      if (ranking.rank === 1) {
        notification = {
          title: `🏆 Season Champion!`,
          body: `Congratulations! You finished #1 on the ${leaderboardName} leaderboard with ${ranking.score} points!`,
          type: 'milestone',
          priority: 'high'
        };
      } else if (ranking.rank <= 3) {
        notification = {
          title: `🏅 Podium Finish!`,
          body: `Great job! You finished #${ranking.rank} on the ${leaderboardName} leaderboard!`,
          type: 'milestone',
          priority: 'high'
        };
      } else if (ranking.rank <= 10) {
        notification = {
          title: `🌟 Top 10 Finish!`,
          body: `Well done! You finished #${ranking.rank} on the ${leaderboardName} leaderboard!`,
          type: 'milestone',
          priority: 'medium'
        };
      } else {
        notification = {
          title: `Season Complete!`,
          body: `The ${leaderboardName} season has ended. You finished at rank #${ranking.rank}. New season starting now!`,
          type: 'reset',
          priority: 'low'
        };
      }
      
      await this.sendNotification(ranking.userId, notification);
    }
  }
}
