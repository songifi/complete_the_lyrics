import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PlayerStats } from '../entities/player-stats.entity';

export interface TrendData {
  date: string;
  value: number;
  category: string;
}

export interface PerformanceAnalytics {
  trends: TrendData[];
  averages: { [key: string]: number };
  peaks: { [key: string]: { value: number; date: string } };
  improvements: { [key: string]: number }; // percentage change
}

export interface PlayerComparison {
  playerId: string;
  username: string;
  metrics: { [key: string]: number };
  rank: number;
  percentile: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(PlayerStats)
    private readonly playerStatsRepository: Repository<PlayerStats>
  ) {}

  async getPerformanceAnalytics(
    playerId: string,
    category: string,
    timeframe: string = '30d'
  ): Promise<PerformanceAnalytics> {
    const startDate = this.getStartDate(timeframe);
    
    const stats = await this.playerStatsRepository.find({
      where: {
        playerId,
        category,
        recordedAt: Between(startDate, new Date())
      },
      order: { recordedAt: 'ASC' }
    });

    const trends = this.calculateTrends(stats);
    const averages = this.calculateAverages(stats);
    const peaks = this.calculatePeaks(stats);
    const improvements = this.calculateImprovements(stats);

    return { trends, averages, peaks, improvements };
  }

  async comparePlayer(
    playerId: string,
    category: string,
    timeframe: string = '30d',
    limit: number = 10
  ): Promise<PlayerComparison[]> {
    const startDate = this.getStartDate(timeframe);
    
    // Get aggregated stats for all players in the timeframe
    const query = this.playerStatsRepository
      .createQueryBuilder('stats')
      .select('stats.playerId', 'playerId')
      .addSelect('player.username', 'username')
      .addSelect('AVG(stats.calculatedScore)', 'avgScore')
      .addSelect('SUM((stats.metrics->>\'kills\')::int)', 'totalKills')
      .addSelect('SUM((stats.metrics->>\'deaths\')::int)', 'totalDeaths')
      .addSelect('AVG((stats.metrics->>\'accuracy\')::float)', 'avgAccuracy')
      .addSelect('SUM((stats.metrics->>\'experience\')::int)', 'totalExperience')
      .leftJoin('players', 'player', 'player.id = stats.playerId')
      .where('stats.category = :category', { category })
      .andWhere('stats.recordedAt >= :startDate', { startDate })
      .groupBy('stats.playerId, player.username')
      .orderBy('AVG(stats.calculatedScore)', 'DESC')
      .limit(limit);

    const results = await query.getRawMany();
    
    return results.map((result, index) => ({
      playerId: result.playerId,
      username: result.username,
      metrics: {
        avgScore: parseFloat(result.avgScore) || 0,
        totalKills: parseInt(result.totalKills) || 0,
        totalDeaths: parseInt(result.totalDeaths) || 0,
        avgAccuracy: parseFloat(result.avgAccuracy) || 0,
        totalExperience: parseInt(result.totalExperience) || 0
      },
      rank: index + 1,
      percentile: Math.round(((results.length - index) / results.length) * 100)
    }));
  }

  private calculateTrends(stats: PlayerStats[]): TrendData[] {
    const dailyData = new Map<string, { total: number; count: number }>();
    
    stats.forEach(stat => {
      const date = stat.recordedAt.toISOString().split('T')[0];
      const existing = dailyData.get(date) || { total: 0, count: 0 };
      
      dailyData.set(date, {
        total: existing.total + stat.calculatedScore,
        count: existing.count + 1
      });
    });

    const trends: TrendData[] = [];
    dailyData.forEach((data, date) => {
      trends.push({
        date,
        value: data.total / data.count,
        category: stats[0]?.category || 'unknown'
      });
    });

    return trends.sort((a, b) => a.date.localeCompare(b.date));
  }

  private calculateAverages(stats: PlayerStats[]): { [key: string]: number } {
    if (stats.length === 0) return {};

    const totals: { [key: string]: number } = {};
    const counts: { [key: string]: number } = {};

    stats.forEach(stat => {
      Object.entries(stat.metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          totals[key] = (totals[key] || 0) + value;
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    });

    const averages: { [key: string]: number } = {};
    Object.keys(totals).forEach(key => {
      averages[key] = Math.round((totals[key] / counts[key]) * 100) / 100;
    });

    return averages;
  }

  private calculatePeaks(stats: PlayerStats[]): { [key: string]: { value: number; date: string } } {
    const peaks: { [key: string]: { value: number; date: string } } = {};

    stats.forEach(stat => {
      Object.entries(stat.metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          if (!peaks[key] || value > peaks[key].value) {
          peaks[key] = {
            value,
            date: stat.recordedAt.toISOString().split('T')[0]
          };
        }
      });
    });

    return peaks;
  }

  private calculateImprovements(stats: PlayerStats[]): { [key: string]: number } {
    if (stats.length < 2) return {};

    const improvements: { [key: string]: number } = {};
    const sortedStats = stats.sort((a, b) => 
      new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime()
    );

    const firstPeriod = sortedStats.slice(0, Math.floor(sortedStats.length / 2));
    const secondPeriod = sortedStats.slice(Math.floor(sortedStats.length / 2));

    const firstAverages = this.calculateAverages(firstPeriod);
    const secondAverages = this.calculateAverages(secondPeriod);

    Object.keys(firstAverages).forEach(key => {
      if (secondAverages[key] && firstAverages[key] > 0) {
        const improvement = ((secondAverages[key] - firstAverages[key]) / firstAverages[key]) * 100;
        improvements[key] = Math.round(improvement * 100) / 100;
      }
    });

    return improvements;
  }

  private getStartDate(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  }
}
