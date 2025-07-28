import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { PlayerStats } from '../entities/player-stats.entity';
import { Player } from '../entities/player.entity';
import { ScoringService } from './scoring.service';
import { AchievementService } from './achievement.service';
import { RedisLeaderboardService } from './redis-leaderboard.service';

export interface CreatePlayerStatsDto {
  playerId: string;
  category: string;
  metrics: any;
  metadata?: any;
}

@Injectable()
export class PlayerStatsService {
  constructor(
    @InjectRepository(PlayerStats)
    private readonly playerStatsRepository: Repository<PlayerStats>,
    @InjectRepository(Player)
    private readonly playerRepository: Repository<Player>,
    private readonly scoringService: ScoringService,
    private readonly achievementService: AchievementService,
    private readonly redisLeaderboardService: RedisLeaderboardService
  ) {}

  async createPlayerStats(dto: CreatePlayerStatsDto): Promise<PlayerStats> {
    // Verify player exists
    const player = await this.playerRepository.findOne({
      where: { id: dto.playerId }
    });

    if (!player) {
      throw new Error('Player not found');
    }

    // Create stats record
    const stats = this.playerStatsRepository.create({
      playerId: dto.playerId,
      category: dto.category,
      metrics: dto.metrics,
      metadata: dto.metadata || {}
    });

    // Calculate score
    stats.calculatedScore = this.scoringService.calculateScore(stats);

    // Save to database
    const savedStats = await this.playerStatsRepository.save(stats);

    // Update leaderboards asynchronously
    setImmediate(async () => {
      try {
        await this.updateLeaderboards(player, savedStats);
        await this.checkAchievements(dto.playerId);
      } catch (error) {
        console.error('Failed to update leaderboards or achievements:', error);
      }
    });

    return savedStats;
  }

  async getPlayerStats(
    playerId: string,
    category?: string,
    timeframe?: string
  ): Promise<PlayerStats[]> {
    const query = this.playerStatsRepository.createQueryBuilder('stats')
      .where('stats.playerId = :playerId', { playerId });

    if (category) {
      query.andWhere('stats.category = :category', { category });
    }

    if (timeframe) {
      const startDate = this.getTimeframeStartDate(timeframe);
      query.andWhere('stats.recordedAt >= :startDate', { startDate });
    }

    return query.orderBy('stats.recordedAt', 'DESC').getMany();
  }

  async getPlayerSummary(playerId: string): Promise<any> {
    const stats = await this.getPlayerStats(playerId);
    const achievements = await this.achievementService.getPlayerAchievements(playerId);
    
    // Calculate category totals
    const categoryTotals = stats.reduce((acc, stat) => {
      if (!acc[stat.category]) {
        acc[stat.category] = { count: 0, totalScore: 0, metrics: {} };
      }
      
      acc[stat.category].count++;
      acc[stat.category].totalScore += stat.calculatedScore;
      
      // Aggregate metrics
      Object.entries(stat.metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          acc[stat.category].metrics[key] = 
            (acc[stat.category].metrics[key] || 0) + value;
        }
      });
      
      return acc;
    }, {});

    // Calculate overall score
    const overallScore = this.scoringService.calculateOverallScore(stats);

    return {
      playerId,
      overallScore,
      totalStats: stats.length,
      totalAchievements: achievements.length,
      categoryTotals,
      achievements: achievements.slice(0, 5), // Latest 5 achievements
      recentStats: stats.slice(0, 10) // Latest 10 stats
    };
  }

  private async updateLeaderboards(player: Player, stats: PlayerStats) {
    const timeframes = ['daily', 'weekly', 'monthly', 'all-time'];
    
    for (const timeframe of timeframes) {
      await this.redisLeaderboardService.updatePlayerScore(
        stats.category,
        timeframe,
        player.id,
        player.username,
        stats.calculatedScore
      );

      // Also update overall leaderboard
      const overallScore = await this.calculatePlayerOverallScore(player.id, timeframe);
      await this.redisLeaderboardService.updatePlayerScore(
        'overall',
        timeframe,
        player.id,
        player.username,
        overallScore
      );
    }
  }

  private async calculatePlayerOverallScore(playerId: string, timeframe: string): Promise<number> {
    const startDate = this.getTimeframeStartDate(timeframe);
    const stats = await this.playerStatsRepository.find({
      where: {
        playerId,
        recordedAt: Between(startDate, new Date())
      }
    });

    return this.scoringService.calculateOverallScore(stats);
  }

  private async checkAchievements(playerId: string) {
    const stats = await this.getPlayerStats(playerId);
    await this.achievementService.checkAndUnlockAchievements(playerId, stats);
  }

  private getTimeframeStartDate(timeframe: string): Date {
    const now = new Date();
    switch (timeframe) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly':
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        return startOfWeek;
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'all-time':
        return new Date(2020, 0, 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }
}