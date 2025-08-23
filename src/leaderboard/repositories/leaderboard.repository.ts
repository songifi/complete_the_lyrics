import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { Leaderboard, LeaderboardType, LeaderboardPeriod } from '../entities/leaderboard.entity';
import { LeaderboardEntry } from '../entities/leaderboard-entry.entity';

@Injectable()
export class LeaderboardRepository extends Repository<Leaderboard> {
  constructor(private dataSource: DataSource) {
    super(Leaderboard, dataSource.createEntityManager());
  }

  async findActiveLeaderboard(type: LeaderboardType, period: LeaderboardPeriod, category: string): Promise<Leaderboard> {
    return this.findOne({
      where: { type, period, category, isActive: true },
      relations: ['entries']
    });
  }

  async getRankings(leaderboardId: string, limit = 100): Promise<LeaderboardEntry[]> {
    return this.dataSource
      .getRepository(LeaderboardEntry)
      .find({
        where: { leaderboardId },
        order: { rank: 'ASC' },
        take: limit
      });
  }

  async updateRankings(leaderboardId: string, userScores: Array<{ userId: string; score: number }>): Promise<void> {
    const entryRepo = this.dataSource.getRepository(LeaderboardEntry);
    
    await entryRepo.delete({ leaderboardId });
    
    const sortedScores = userScores.sort((a, b) => b.score - a.score);
    const entries = sortedScores.map((item, index) => 
      entryRepo.create({
        leaderboardId,
        userId: item.userId,
        rank: index + 1,
        score: item.score
      })
    );
    
    await entryRepo.save(entries);
  }
}