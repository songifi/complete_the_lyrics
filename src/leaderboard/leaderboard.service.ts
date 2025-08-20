import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Leaderboard, LeaderboardType, LeaderboardPeriod } from './entities/leaderboard.entity';
import { LeaderboardEntry } from './entities/leaderboard-entry.entity';
import { LeaderboardArchive } from './entities/leaderboard-archive.entity';
import { LeaderboardRepository } from './repositories/leaderboard.repository';

@Injectable()
export class LeaderboardService {
  constructor(
    private leaderboardRepository: LeaderboardRepository,
    @InjectRepository(LeaderboardEntry)
    private entryRepository: Repository<LeaderboardEntry>,
    @InjectRepository(LeaderboardArchive)
    private archiveRepository: Repository<LeaderboardArchive>
  ) {}

  async getOrCreateLeaderboard(type: LeaderboardType, period: LeaderboardPeriod, category: string): Promise<Leaderboard> {
    let leaderboard = await this.leaderboardRepository.findActiveLeaderboard(type, period, category);
    
    if (!leaderboard) {
      leaderboard = this.leaderboardRepository.create({
        type,
        period,
        category,
        startDate: new Date(),
        isActive: true
      });
      await this.leaderboardRepository.save(leaderboard);
    }
    
    return leaderboard;
  }

  async updateUserScore(userId: string, score: number, type: LeaderboardType, period: LeaderboardPeriod, category: string): Promise<void> {
    const leaderboard = await this.getOrCreateLeaderboard(type, period, category);
    
    await this.entryRepository.upsert({
      leaderboardId: leaderboard.id,
      userId,
      score,
      rank: 0 // Will be recalculated
    }, ['userId', 'leaderboardId']);
    
    await this.recalculateRankings(leaderboard.id);
  }

  async getRankings(type: LeaderboardType, period: LeaderboardPeriod, category: string, limit = 100): Promise<LeaderboardEntry[]> {
    const leaderboard = await this.leaderboardRepository.findActiveLeaderboard(type, period, category);
    if (!leaderboard) return [];
    
    return this.leaderboardRepository.getRankings(leaderboard.id, limit);
  }

  async archiveLeaderboard(leaderboardId: string): Promise<void> {
    const leaderboard = await this.leaderboardRepository.findOne({
      where: { id: leaderboardId },
      relations: ['entries']
    });
    
    if (leaderboard) {
      await this.archiveRepository.save({
        originalLeaderboardId: leaderboardId,
        leaderboardData: { ...leaderboard, entries: undefined },
        entriesData: leaderboard.entries
      });
      
      await this.leaderboardRepository.update(leaderboardId, { isActive: false });
    }
  }

  private async recalculateRankings(leaderboardId: string): Promise<void> {
    const entries = await this.entryRepository.find({
      where: { leaderboardId },
      order: { score: 'DESC' }
    });
    
    for (let i = 0; i < entries.length; i++) {
      entries[i].rank = i + 1;
    }
    
    await this.entryRepository.save(entries);
  }
}