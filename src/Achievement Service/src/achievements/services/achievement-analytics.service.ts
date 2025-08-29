import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AchievementAnalytics } from '../entities/achievement-analytics.entity';
import { UserAchievement } from '../entities/user-achievement.entity';

@Injectable()
export class AchievementAnalyticsService {
  constructor(
    @InjectRepository(AchievementAnalytics)
    private analyticsRepository: Repository<AchievementAnalytics>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
  ) {}

  async trackAchievementUnlock(userId: string, achievementId: string) {
    const analytics = this.analyticsRepository.create({
      userId,
      achievementId,
      eventType: 'unlock',
      timestamp: new Date(),
      metadata: {},
    });

    await this.analyticsRepository.save(analytics);
  }

  async getUserAnalytics(userId: string) {
    const totalAchievements = await this.userAchievementRepository.count({
      where: { userId, status: 'unlocked' },
    });

    const categoryStats = await this.userAchievementRepository
      .createQueryBuilder('ua')
      .leftJoin('ua.achievement', 'achievement')
      .select('achievement.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(achievement.points)', 'points')
      .where('ua.userId = :userId AND ua.status = :status', {
        userId,
        status: 'unlocked',
      })
      .groupBy('achievement.category')
      .getRawMany();

    const recentUnlocks = await this.userAchievementRepository.find({
      where: { userId, status: 'unlocked' },
      relations: ['achievement'],
      order: { unlockedAt: 'DESC' },
      take: 5,
    });

    const streakData = await this.calculateAchievementStreak(userId);

    return {
      totalAchievements,
      totalPoints: categoryStats.reduce((sum, cat) => sum + (cat.points || 0), 0),
      categoryStats,
      recentUnlocks,
      achievementStreak: streakData,
      completionRate: await this.calculateCompletionRate(userId),
    };
  }

  async getGlobalAnalytics() {
    const totalUsers = await this.userAchievementRepository
      .createQueryBuilder('ua')
      .select('DISTINCT ua.userId')
      .getCount();

    const achievementStats = await this.userAchievementRepository
      .createQueryBuilder('ua')
      .leftJoin('ua.achievement', 'achievement')
      .select('achievement.id', 'achievementId')
      .addSelect('achievement.name', 'achievementName')
      .addSelect('COUNT(*)', 'unlockCount')
      .addSelect('achievement.targetValue', 'difficulty')
      .where('ua.status = :status', { status: 'unlocked' })
      .groupBy('achievement.id, achievement.name, achievement.targetValue')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return {
      totalUsers,
      achievementStats: achievementStats.map(stat => ({
        ...stat,
        unlockRate: (stat.unlockCount / totalUsers) * 100,
      })),
    };
  }

  private async calculateAchievementStreak(userId: string) {
    const unlocks = await this.userAchievementRepository.find({
      where: { userId, status: 'unlocked' },
      order: { unlockedAt: 'DESC' },
      select: ['unlockedAt'],
    });

    if (unlocks.length === 0) return { current: 0, longest: 0 };

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 1;

    // Calculate streaks based on consecutive days with achievements
    for (let i = 1; i < unlocks.length; i++) {
      const currentDate = new Date(unlocks[i - 1].unlockedAt);
      const previousDate = new Date(unlocks[i].unlockedAt);
      
      const dayDiff = Math.floor(
        (currentDate.getTime() - previousDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (dayDiff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);
    
    // Check if current streak is active (achievement unlocked today or yesterday)
    const lastUnlock = new Date(unlocks[0].unlockedAt);
    const today = new Date();
    const daysSinceLastUnlock = Math.floor(
      (today.getTime() - lastUnlock.getTime()) / (1000 * 60 * 60 * 24)
    );

    currentStreak = daysSinceLastUnlock <= 1 ? tempStreak : 0;

    return { current: currentStreak, longest: longestStreak };
  }

  private async calculateCompletionRate(userId: string) {
    const totalAchievements = await this.userAchievementRepository.count();
    const userAchievements = await this.userAchievementRepository.count({
      where: { userId, status: 'unlocked' },
    });

    return totalAchievements > 0 ? (userAchievements / totalAchievements) * 100 : 0;
  }
}
