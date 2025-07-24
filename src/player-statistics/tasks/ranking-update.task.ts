import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerStats } from '../entities/player-stats.entity';
import { LeaderboardEntry } from '../entities/leaderboard-entry.entity';
import { RedisLeaderboardService } from '../services/redis-leaderboard.service';
import { WorkerService } from '../services/worker.service';

@Injectable()
export class RankingUpdateTask {
  private readonly logger = new Logger(RankingUpdateTask.name);

  constructor(
    @InjectRepository(PlayerStats)
    private readonly playerStatsRepository: Repository<PlayerStats>,
    @InjectRepository(LeaderboardEntry)
    private readonly leaderboardRepository: Repository<LeaderboardEntry>,
    private readonly redisLeaderboardService: RedisLeaderboardService,
    private readonly workerService: WorkerService
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async updateHourlyRankings() {
    this.logger.log('Starting hourly ranking update');
    
    try {
      const categories = ['combat', 'exploration', 'social', 'achievement', 'overall'];
      const timeframes = ['daily', 'weekly'];

      for (const category of categories) {
        for (const timeframe of timeframes) {
          await this.updateCategoryRankings(category, timeframe);
        }
      }

      this.logger.log('Hourly ranking update completed');
    } catch (error) {
      this.logger.error('Failed to update hourly rankings', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async updateDailyRankings() {
    this.logger.log('Starting daily ranking update');
    
    try {
      const categories = ['combat', 'exploration', 'social', 'achievement', 'overall'];
      
      for (const category of categories) {
        await this.updateCategoryRankings(category, 'monthly');
        await this.updateCategoryRankings(category, 'all-time');
      }

      // Clean up old daily rankings
      await this.cleanupOldRankings();

      this.logger.log('Daily ranking update completed');
    } catch (error) {
      this.logger.error('Failed to update daily rankings', error);
    }
  }

  private async updateCategoryRankings(category: string, timeframe: string) {
    const startDate = this.getTimeframeStartDate(timeframe);
    
    // Get stats for the timeframe
    const stats = await this.playerStatsRepository
      .createQueryBuilder('stats')
      .leftJoinAndSelect('stats.player', 'player')
      .where('stats.category = :category', { category })
      .andWhere('stats.recordedAt >= :startDate', { startDate })
      .getMany();

    if (stats.length === 0) return;

    // Use worker thread for heavy calculations
    const rankings = await this.workerService.calculateRankings({
      playerStats: stats,
      weights: this.getCategoryWeights()
    });

    // Update Redis leaderboards
    for (const ranking of rankings) {
      const player = stats.find(s => s.playerId === ranking.playerId)?.player;
      if (player) {
        await this.redisLeaderboardService.updatePlayerScore(
          category,
          timeframe,
          ranking.playerId,
          player.username,
          ranking.score,
          ranking.categoryScores
        );
      }
    }

    // Update database leaderboard entries
    await this.updateDatabaseLeaderboard(category, timeframe, rankings);
  }

  private async updateDatabaseLeaderboard(
    category: string,
    timeframe: string,
    rankings: any[]
  ) {
    // Remove existing entries for this category/timeframe
    await this.leaderboardRepository.delete({ category, timeframe });

    // Insert new rankings
    const entries = rankings.slice(0, 1000).map(ranking => // Top 1000 only
      this.leaderboardRepository.create({
        playerId: ranking.playerId,
        username: ranking.playerId, // Will be updated with actual username
        category,
        timeframe,
        rank: ranking.rank,
        score: ranking.score,
        additionalData: ranking.categoryScores
      })
    );

    await this.leaderboardRepository.save(entries);
  }

  private async cleanupOldRankings() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90); // Keep 90 days

    await this.leaderboardRepository
      .createQueryBuilder()
      .delete()
      .where('timeframe = :timeframe', { timeframe: 'daily' })
      .andWhere('createdAt < :cutoffDate', { cutoffDate })
      .execute();
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
        return new Date(2020, 0, 1); // Arbitrary old date
      default:
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  }

  private getCategoryWeights() {
    return {
      combat: 0.3,
      exploration: 0.25,
      social: 0.15,
      achievement: 0.3
    };
  }
}

// ===== SERVICES CONTINUED =====
// services/worker.service.ts
import { Injectable } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as path from 'path';

@Injectable()
export class WorkerService {
  async calculateRankings(data: any): Promise<any> {
    return this.runWorker('CALCULATE_RANKINGS', data);
  }

  async processBatchStats(data: any): Promise<any> {
    return this.runWorker('PROCESS_BATCH_STATS', data);
  }

  async generateAnalytics(data: any): Promise<any> {
    return this.runWorker('GENERATE_ANALYTICS', data);
  }

  private runWorker(type: string, payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(
        path.join(__dirname, '../workers/stats-calculation.worker.js'),
        {
          workerData: { type, payload }
        }
      );

      worker.on('message', (result) => {
        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error));
        }
        worker.terminate();
      });

      worker.on('error', (error) => {
        reject(error);
        worker.terminate();
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }
}
