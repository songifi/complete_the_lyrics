import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AchievementReward } from '../entities/achievement-reward.entity';
import { Achievement } from '../entities/achievement.entity';

@Injectable()
export class AchievementRewardService {
  constructor(
    @InjectRepository(AchievementReward)
    private rewardRepository: Repository<AchievementReward>,
    private eventEmitter: EventEmitter2,
  ) {}

  async distributeRewards(userId: string, achievementRewards: any[]) {
    const distributedRewards = [];

    for (const rewardTemplate of achievementRewards) {
      const reward = this.rewardRepository.create({
        userId,
        achievementId: rewardTemplate.achievementId,
        type: rewardTemplate.type,
        value: rewardTemplate.value,
        metadata: rewardTemplate.metadata,
        claimed: false,
        earnedAt: new Date(),
      });

      await this.rewardRepository.save(reward);
      distributedRewards.push(reward);

      // Emit reward earned event
      this.eventEmitter.emit('achievement.reward.earned', {
        userId,
        reward,
      });
    }

    return distributedRewards;
  }

  async processRewardClaim(userId: string, rewardId: string) {
    const reward = await this.rewardRepository.findOne({
      where: { id: rewardId, userId },
    });

    if (!reward || reward.claimed) {
      return null;
    }

    // Process the reward based on type
    switch (reward.type) {
      case 'points':
        await this.awardPoints(userId, reward.value);
        break;
      case 'badge':
        await this.awardBadge(userId, reward.metadata.badgeId);
        break;
      case 'item':
        await this.awardItem(userId, reward.metadata.itemId, reward.value);
        break;
      case 'currency':
        await this.awardCurrency(userId, reward.metadata.currencyType, reward.value);
        break;
      default:
        console.log('Unknown reward type:', reward.type);
    }

    reward.claimed = true;
    reward.claimedAt = new Date();
    await this.rewardRepository.save(reward);

    return reward;
  }

  private async awardPoints(userId: string, points: number) {
    // Implementation depends on your user points system
    this.eventEmitter.emit('user.points.awarded', { userId, points });
  }

  private async awardBadge(userId: string, badgeId: string) {
    // Implementation depends on your badge system
    this.eventEmitter.emit('user.badge.awarded', { userId, badgeId });
  }

  private async awardItem(userId: string, itemId: string, quantity: number) {
    // Implementation depends on your inventory system
    this.eventEmitter.emit('user.item.awarded', { userId, itemId, quantity });
  }

  private async awardCurrency(userId: string, currencyType: string, amount: number) {
    // Implementation depends on your currency system
    this.eventEmitter.emit('user.currency.awarded', { userId, currencyType, amount });
  }
}