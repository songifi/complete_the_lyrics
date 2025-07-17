import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStats } from '../entities/user-stats.entity';

export interface StatsUpdateDto {
  userId: number;
  isCorrect: boolean;
  pointsEarned: number;
}

export interface LeaderboardEntry {
  userId: number;
  totalAttempts: number;
  correctAttempts: number;
  score: number;
  accuracyRate: number;
  rank: number;
}

@Injectable()
export class UserStatsService {
  constructor(
    @InjectRepository(UserStats)
    private userStatsRepository: Repository<UserStats>,
  ) {}

  async findByUserId(userId: number): Promise<UserStats> {
    const stats = await this.userStatsRepository.findOne({ where: { userId } });
    if (!stats) {
      throw new NotFoundException(`Stats not found for user ${userId}`);
    }
    return stats;
  }

  async createOrUpdateStats(updateData: StatsUpdateDto): Promise<UserStats> {
    let stats = await this.userStatsRepository.findOne({
      where: { userId: updateData.userId },
    });

    if (!stats) {
      // Create new stats record
      stats = this.userStatsRepository.create({
        userId: updateData.userId,
        totalAttempts: 1,
        correctAttempts: updateData.isCorrect ? 1 : 0,
        score: updateData.pointsEarned,
      });
    } else {
      // Update existing stats
      stats.totalAttempts += 1;
      if (updateData.isCorrect) {
        stats.correctAttempts += 1;
      }
      stats.score += updateData.pointsEarned;
    }

    // Calculate accuracy rate
    stats.accuracyRate = stats.calculateAccuracyRate();

    return await this.userStatsRepository.save(stats);
  }

  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    const stats = await this.userStatsRepository.find({
      order: { score: 'DESC' },
      take: limit,
    });

    return stats.map((stat, index) => ({
      userId: stat.userId,
      totalAttempts: stat.totalAttempts,
      correctAttempts: stat.correctAttempts,
      score: stat.score,
      accuracyRate: stat.accuracyRate,
      rank: index + 1,
    }));
  }

  async getUserRank(userId: number): Promise<number> {
    const userStats = await this.findByUserId(userId);
    const rank = await this.userStatsRepository
      .createQueryBuilder('stats')
      .where('stats.score > :score', { score: userStats.score })
      .getCount();

    return rank + 1;
  }

  async resetUserStats(userId: number): Promise<UserStats> {
    const stats = await this.findByUserId(userId);
    stats.totalAttempts = 0;
    stats.correctAttempts = 0;
    stats.score = 0;
    stats.accuracyRate = 0;

    return await this.userStatsRepository.save(stats);
  }

  async getStatsForExport({
    userId,
    from,
    to,
    category,
  }: {
    userId?: string;
    from?: string;
    to?: string;
    category?: string;
  }) {
    // Implement actual filtering logic as needed
    const query = this.userStatsRepository.createQueryBuilder('stats');
    if (userId) query.andWhere('stats.userId = :userId', { userId });
    if (from) query.andWhere('stats.createdAt >= :from', { from });
    if (to) query.andWhere('stats.createdAt <= :to', { to });
    // category filtering would require a join if category is not in user stats
    return query.getMany();
  }
}
