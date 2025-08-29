import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { AchievementReward } from './entities/achievement-reward.entity';
import { GetAchievementsQueryDto } from './dto/get-achievements-query.dto';
import { AchievementNotificationService } from './services/achievement-notification.service';
import { AchievementRewardService } from './services/achievement-reward.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    @InjectRepository(AchievementReward)
    private rewardRepository: Repository<AchievementReward>,
    private notificationService: AchievementNotificationService,
    private rewardService: AchievementRewardService,
    private eventEmitter: EventEmitter2,
  ) {}

  async getUserAchievements(userId: string, query: GetAchievementsQueryDto) {
    const queryBuilder = this.userAchievementRepository
      .createQueryBuilder('ua')
      .leftJoinAndSelect('ua.achievement', 'achievement')
      .leftJoinAndSelect('achievement.rewards', 'rewards')
      .where('ua.userId = :userId', { userId });

    if (query.status) {
      queryBuilder.andWhere('ua.status = :status', { status: query.status });
    }

    if (query.category) {
      queryBuilder.andWhere('achievement.category = :category', {
        category: query.category,
      });
    }

    const achievements = await queryBuilder
      .orderBy('ua.unlockedAt', 'DESC')
      .take(query.limit || 20)
      .skip(query.offset || 0)
      .getMany();

    return {
      data: achievements,
      total: await queryBuilder.getCount(),
    };
  }

  async getAvailableAchievements(userId: string) {
    const allAchievements = await this.achievementRepository.find({
      where: { isActive: true },
      relations: ['rewards'],
    });

    const userAchievements = await this.userAchievementRepository.find({
      where: { userId },
      relations: ['achievement'],
    });

    const userAchievementIds = new Set(
      userAchievements.map((ua) => ua.achievement.id),
    );

    return allAchievements.filter((achievement) => {
      // Show all achievements, but mark which ones are unlocked
      const userAchievement = userAchievements.find(
        (ua) => ua.achievement.id === achievement.id,
      );

      return {
        ...achievement,
        status: userAchievement?.status || 'locked',
        progress: userAchievement?.progress || 0,
        unlockedAt: userAchievement?.unlockedAt,
      };
    });
  }

  async unlockAchievement(userId: string, achievementId: string) {
    const achievement = await this.achievementRepository.findOne({
      where: { id: achievementId },
      relations: ['rewards'],
    });

    if (!achievement) {
      throw new NotFoundException('Achievement not found');
    }

    let userAchievement = await this.userAchievementRepository.findOne({
      where: { userId, achievement: { id: achievementId } },
      relations: ['achievement'],
    });

    if (!userAchievement) {
      userAchievement = this.userAchievementRepository.create({
        userId,
        achievement,
        status: 'unlocked',
        progress: achievement.targetValue,
        unlockedAt: new Date(),
      });
    } else if (userAchievement.status !== 'unlocked') {
      userAchievement.status = 'unlocked';
      userAchievement.progress = achievement.targetValue;
      userAchievement.unlockedAt = new Date();
    }

    await this.userAchievementRepository.save(userAchievement);

    // Send notification
    await this.notificationService.sendAchievementUnlockedNotification(
      userId,
      achievement,
    );

    // Distribute rewards
    await this.rewardService.distributeRewards(userId, achievement.rewards);

    // Emit event for analytics
    this.eventEmitter.emit('achievement.unlocked', {
      userId,
      achievementId,
      achievement,
      unlockedAt: new Date(),
    });

    return userAchievement;
  }

  async getLeaderboard(category?: string) {
    const queryBuilder = this.userAchievementRepository
      .createQueryBuilder('ua')
      .leftJoin('ua.achievement', 'achievement')
      .select('ua.userId', 'userId')
      .addSelect('COUNT(ua.id)', 'achievementCount')
      .addSelect('SUM(achievement.points)', 'totalPoints')
      .where('ua.status = :status', { status: 'unlocked' })
      .groupBy('ua.userId');

    if (category) {
      queryBuilder.andWhere('achievement.category = :category', { category });
    }

    return queryBuilder
      .orderBy('totalPoints', 'DESC')
      .addOrderBy('achievementCount', 'DESC')
      .limit(100)
      .getRawMany();
  }

  async getUnclaimedRewards(userId: string) {
    return this.rewardRepository.find({
      where: { userId, claimed: false },
      relations: ['achievement'],
    });
  }

  async claimReward(userId: string, rewardId: string) {
    const reward = await this.rewardRepository.findOne({
      where: { id: rewardId, userId },
      relations: ['achievement'],
    });

    if (!reward) {
      throw new NotFoundException('Reward not found');
    }

    if (reward.claimed) {
      throw new Error('Reward already claimed');
    }

    reward.claimed = true;
    reward.claimedAt = new Date();

    await this.rewardRepository.save(reward);

    // Emit event for reward claimed
    this.eventEmitter.emit('achievement.reward.claimed', {
      userId,
      rewardId,
      reward,
    });

    return reward;
  }
}