import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatistic, StatisticType } from '../entities/user-statistic.entity';
import { UserProfile } from '../entities/user-profile.entity';

@Injectable()
export class UserStatisticsService {
  constructor(
    @InjectRepository(UserStatistic)
    private userStatisticRepository: Repository<UserStatistic>,
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
  ) {}

  async getUserStatistics(userId: string): Promise<any> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    const statistics = await this.userStatisticRepository.find({
      where: { userProfileId: profile.id },
    });

    const stats = {};
    statistics.forEach(stat => {
      if (!stats[stat.type]) {
        stats[stat.type] = {};
      }
      stats[stat.type][stat.period] = stat.value;
    });

    return {
      averageGameDuration: stats[StatisticType.AVERAGE_GAME_DURATION]?.['all'] || 0,
      longestWinStreak: stats[StatisticType.LONGEST_WIN_STREAK]?.['all'] || 0,
      currentWinStreak: stats[StatisticType.CURRENT_WIN_STREAK]?.['all'] || 0,
      fastestGameCompletion: stats[StatisticType.FASTEST_GAME_COMPLETION]?.['all'] || 0,
      perfectGames: stats[StatisticType.PERFECT_GAMES]?.['all'] || 0,
      totalPlaytimeMinutes: stats[StatisticType.TOTAL_PLAYTIME_MINUTES]?.['all'] || 0,
      friendsAdded: stats[StatisticType.FRIENDS_ADDED]?.['all'] || 0,
      achievementsEarned: stats[StatisticType.ACHIEVEMENTS_EARNED]?.['all'] || 0,
      badgesEarned: stats[StatisticType.BADGES_EARNED]?.['all'] || 0,
      dailyStats: this.extractDailyStats(stats),
      weeklyStats: this.extractWeeklyStats(stats),
      monthlyStats: this.extractMonthlyStats(stats),
    };
  }

  async incrementStatistic(
    userId: string,
    type: StatisticType,
    amount: number = 1,
    date: Date = new Date(),
  ): Promise<void> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    // Update 'all' period statistic
    await this.updateOrCreateStatistic(profile.id, type, 'all', amount);

    // Update period-specific statistics
    const period = UserStatistic.createPeriodKey(type, date);
    if (period !== 'all') {
      await this.updateOrCreateStatistic(profile.id, type, period, amount);
    }
  }

  async setStatistic(
    userId: string,
    type: StatisticType,
    value: number,
    date: Date = new Date(),
  ): Promise<void> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    // Update 'all' period statistic
    await this.setOrCreateStatistic(profile.id, type, 'all', value);

    // Update period-specific statistics
    const period = UserStatistic.createPeriodKey(type, date);
    if (period !== 'all') {
      await this.setOrCreateStatistic(profile.id, type, period, value);
    }
  }

  async getStatisticHistory(
    userId: string,
    type: StatisticType,
    days: number = 30,
  ): Promise<any[]> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const statistics = await this.userStatisticRepository
      .createQueryBuilder('stat')
      .where('stat.userProfileId = :profileId', { profileId: profile.id })
      .andWhere('stat.type = :type', { type })
      .andWhere('stat.period != :all', { all: 'all' })
      .andWhere('stat.createdAt >= :startDate', { startDate })
      .orderBy('stat.period', 'ASC')
      .getMany();

    return statistics.map(stat => ({
      period: stat.period,
      value: stat.value,
      change: stat.getChange(),
      percentageChange: stat.getPercentageChange(),
      lastUpdated: stat.lastUpdated,
    }));
  }

  async getLeaderboardStats(type: StatisticType, limit: number = 10): Promise<any[]> {
    const statistics = await this.userStatisticRepository
      .createQueryBuilder('stat')
      .leftJoinAndSelect('stat.userProfile', 'profile')
      .leftJoinAndSelect('profile.user', 'user')
      .where('stat.type = :type', { type })
      .andWhere('stat.period = :period', { period: 'all' })
      .orderBy('stat.value', 'DESC')
      .limit(limit)
      .getMany();

    return statistics.map(stat => ({
      userId: stat.userProfile.userId,
      username: stat.userProfile.user.username,
      avatarUrl: stat.userProfile.avatarUrl,
      value: stat.value,
      rank: 0, // Will be set by the caller
    }));
  }

  async getComparisonStats(userId: string, type: StatisticType): Promise<any> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    const userStat = await this.userStatisticRepository.findOne({
      where: { userProfileId: profile.id, type, period: 'all' },
    });

    if (!userStat) {
      return { userValue: 0, averageValue: 0, percentile: 0 };
    }

    // Get average value for this statistic type
    const avgResult = await this.userStatisticRepository
      .createQueryBuilder('stat')
      .select('AVG(stat.value)', 'average')
      .where('stat.type = :type', { type })
      .andWhere('stat.period = :period', { period: 'all' })
      .getRawOne();

    // Get percentile rank
    const percentileResult = await this.userStatisticRepository
      .createQueryBuilder('stat')
      .select('COUNT(*)', 'count')
      .where('stat.type = :type', { type })
      .andWhere('stat.period = :period', { period: 'all' })
      .andWhere('stat.value > :userValue', { userValue: userStat.value })
      .getRawOne();

    const totalCount = await this.userStatisticRepository.count({
      where: { type, period: 'all' },
    });

    const percentile = totalCount > 0 ? ((totalCount - parseInt(percentileResult.count)) / totalCount) * 100 : 0;

    return {
      userValue: userStat.value,
      averageValue: parseFloat(avgResult.average) || 0,
      percentile: Math.round(percentile),
    };
  }

  private async updateOrCreateStatistic(
    profileId: string,
    type: StatisticType,
    period: string,
    amount: number,
  ): Promise<void> {
    let statistic = await this.userStatisticRepository.findOne({
      where: { userProfileId: profileId, type, period },
    });

    if (statistic) {
      statistic.increment(amount);
    } else {
      statistic = this.userStatisticRepository.create({
        userProfileId: profileId,
        type,
        period,
        value: amount,
      });
    }

    await this.userStatisticRepository.save(statistic);
  }

  private async setOrCreateStatistic(
    profileId: string,
    type: StatisticType,
    period: string,
    value: number,
  ): Promise<void> {
    let statistic = await this.userStatisticRepository.findOne({
      where: { userProfileId: profileId, type, period },
    });

    if (statistic) {
      statistic.setValue(value);
    } else {
      statistic = this.userStatisticRepository.create({
        userProfileId: profileId,
        type,
        period,
        value,
      });
    }

    await this.userStatisticRepository.save(statistic);
  }

  private extractDailyStats(stats: any): any {
    const dailyStats = {};
    Object.keys(stats).forEach(type => {
      if (stats[type]) {
        Object.keys(stats[type]).forEach(period => {
          if (period.match(/^\d{4}-\d{2}-\d{2}$/)) {
            if (!dailyStats[period]) dailyStats[period] = {};
            dailyStats[period][type] = stats[type][period];
          }
        });
      }
    });
    return dailyStats;
  }

  private extractWeeklyStats(stats: any): any {
    const weeklyStats = {};
    Object.keys(stats).forEach(type => {
      if (stats[type]) {
        Object.keys(stats[type]).forEach(period => {
          if (period.match(/^\d{4}-W\d{2}$/)) {
            if (!weeklyStats[period]) weeklyStats[period] = {};
            weeklyStats[period][type] = stats[type][period];
          }
        });
      }
    });
    return weeklyStats;
  }

  private extractMonthlyStats(stats: any): any {
    const monthlyStats = {};
    Object.keys(stats).forEach(type => {
      if (stats[type]) {
        Object.keys(stats[type]).forEach(period => {
          if (period.match(/^\d{4}-\d{2}$/)) {
            if (!monthlyStats[period]) monthlyStats[period] = {};
            monthlyStats[period][type] = stats[type][period];
          }
        });
      }
    });
    return monthlyStats;
  }
}
