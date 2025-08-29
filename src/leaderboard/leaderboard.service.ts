import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, MoreThan, LessThan, Between } from "typeorm";
import {
  Leaderboard,
  LeaderboardType,
  LeaderboardPeriod,
} from "./entities/leaderboard.entity";
import { LeaderboardEntry } from "./entities/leaderboard-entry.entity";
import { LeaderboardArchive } from "./entities/leaderboard-archive.entity";
import { LeaderboardRepository } from "./repositories/leaderboard.repository";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { Cron, CronExpression } from "@nestjs/schedule";

interface RankChangeEvent {
  userId: string;
  oldRank: number | null;
  newRank: number;
  leaderboardId: string;
  type: LeaderboardType;
  period: LeaderboardPeriod;
  category: string;
  score: number;
}

@Injectable()
export class LeaderboardService {
  private readonly logger = new Logger(LeaderboardService.name);

  constructor(
    private leaderboardRepository: LeaderboardRepository,
    @InjectRepository(LeaderboardEntry)
    private entryRepository: Repository<LeaderboardEntry>,
    @InjectRepository(LeaderboardArchive)
    private archiveRepository: Repository<LeaderboardArchive>,
    private eventEmitter: EventEmitter2,
  ) {}

  async getOrCreateLeaderboard(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string,
  ): Promise<Leaderboard> {
    let leaderboard = await this.leaderboardRepository.findActiveLeaderboard(
      type,
      period,
      category,
    );

    if (!leaderboard) {
      leaderboard = this.leaderboardRepository.create({
        type,
        period,
        category,
        startDate: new Date(),
        isActive: true,
      });
      await this.leaderboardRepository.save(leaderboard);
    }

    return leaderboard;
  }

  async updateUserScore(
    userId: string,
    score: number,
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const leaderboard = await this.getOrCreateLeaderboard(
      type,
      period,
      category,
    );

    // Get old rank for change detection
    const existingEntry = await this.entryRepository.findOne({
      where: { userId, leaderboardId: leaderboard.id },
    });
    const oldRank = existingEntry?.rank || null;

    // Update or create entry with timestamp for tie-breaking
    const entryData = {
      leaderboardId: leaderboard.id,
      userId,
      score,
      rank: 0,
      metadata: {
        ...metadata,
        lastUpdated: new Date().toISOString(),
        firstAchieved:
          existingEntry?.metadata?.firstAchieved || new Date().toISOString(),
      },
    };

    await this.entryRepository.upsert(entryData as any, [
      "userId",
      "leaderboardId",
    ]);

    const newRank = await this.recalculateRankingsWithTieBreaking(
      leaderboard.id,
    );

    const updatedEntry = await this.entryRepository.findOne({
      where: { userId, leaderboardId: leaderboard.id },
    });

    if (updatedEntry && updatedEntry.rank !== oldRank) {
      const rankChangeEvent: RankChangeEvent = {
        userId,
        oldRank,
        newRank: updatedEntry.rank,
        leaderboardId: leaderboard.id,
        type,
        period,
        category,
        score: updatedEntry.score,
      };

      this.eventEmitter.emit("leaderboard.rank.changed", rankChangeEvent);
      this.logger.log(
        `Rank changed for user ${userId}: ${oldRank} -> ${updatedEntry.rank}`,
      );
    }
  }

  async getRankings(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string,
    limit = 100,
  ): Promise<LeaderboardEntry[]> {
    const leaderboard = await this.leaderboardRepository.findActiveLeaderboard(
      type,
      period,
      category,
    );
    if (!leaderboard) return [];

    return this.leaderboardRepository.getRankings(leaderboard.id, limit);
  }

  async archiveLeaderboard(leaderboardId: string): Promise<void> {
    const leaderboard = await this.leaderboardRepository.findOne({
      where: { id: leaderboardId },
      relations: ["entries"],
    });

    if (leaderboard) {
      await this.archiveRepository.save({
        originalLeaderboardId: leaderboardId,
        leaderboardData: { ...leaderboard, entries: undefined },
        entriesData: leaderboard.entries,
      });

      await this.leaderboardRepository.update(leaderboardId, {
        isActive: false,
      });
    }
  }

  private async recalculateRankingsWithTieBreaking(
    leaderboardId: string,
  ): Promise<number> {
    const entries = await this.entryRepository.find({
      where: { leaderboardId },
      order: { score: "DESC", createdAt: "ASC" },
    });

    let currentRank = 1;
    let lastScore = null;
    let sameScoreCount = 0;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (lastScore !== null && entry.score !== lastScore) {
        currentRank = i + 1;
        sameScoreCount = 0;
      } else if (lastScore === entry.score) {
        sameScoreCount++;
        const currentFirstAchieved = new Date(
          entry.metadata?.firstAchieved || entry.createdAt,
        );

        let insertPosition = currentRank - 1;
        for (let j = currentRank - 1; j < i; j++) {
          const compareEntry = entries[j];
          const compareFirstAchieved = new Date(
            compareEntry.metadata?.firstAchieved || compareEntry.createdAt,
          );
          if (currentFirstAchieved < compareFirstAchieved) {
            insertPosition = j;
            break;
          }
        }

        // Adjust ranks for tied entries
        if (insertPosition < i) {
          for (let k = insertPosition; k < i; k++) {
            entries[k].rank = entries[k].rank + 1;
          }
          entry.rank = insertPosition + 1;
        } else {
          entry.rank = currentRank;
        }
      } else {
        entry.rank = currentRank;
      }

      lastScore = entry.score;
    }

    await this.entryRepository.save(entries);
    return entries.length > 0 ? entries[entries.length - 1].rank : 0;
  }

  // Seasonal Management Methods
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyLeaderboardReset(): Promise<void> {
    this.logger.log("Starting daily leaderboard reset...");
    await this.resetLeaderboardsByPeriod(LeaderboardPeriod.DAILY);
  }

  @Cron("0 0 * * 1")
  async handleWeeklyLeaderboardReset(): Promise<void> {
    this.logger.log("Starting weekly leaderboard reset...");
    await this.resetLeaderboardsByPeriod(LeaderboardPeriod.WEEKLY);
  }

  @Cron("0 0 1 * *")
  async handleMonthlyLeaderboardReset(): Promise<void> {
    this.logger.log("Starting monthly leaderboard reset...");
    await this.resetLeaderboardsByPeriod(LeaderboardPeriod.MONTHLY);
  }

  async resetLeaderboardsByPeriod(period: LeaderboardPeriod): Promise<void> {
    const activeLeaderboards = await this.leaderboardRepository.find({
      where: { period, isActive: true },
    });

    for (const leaderboard of activeLeaderboards) {
      await this.archiveLeaderboard(leaderboard.id);
      this.eventEmitter.emit("leaderboard.reset", {
        leaderboardId: leaderboard.id,
        type: leaderboard.type,
        period: leaderboard.period,
        category: leaderboard.category,
        resetAt: new Date(),
      });
    }

    this.logger.log(
      `Reset ${activeLeaderboards.length} ${period} leaderboards`,
    );
  }

  @Cron(CronExpression.EVERY_6_HOURS)
  async applyRankingDecay(): Promise<void> {
    this.logger.log("Applying ranking decay for inactive players...");

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    const inactiveEntries = await this.entryRepository
      .createQueryBuilder("entry")
      .where("entry.metadata->>'lastUpdated' < :cutoffDate", {
        cutoffDate: cutoffDate.toISOString(),
      })
      .orWhere(
        "entry.metadata->>'lastUpdated' IS NULL AND entry.createdAt < :cutoffDate",
        { cutoffDate },
      )
      .getMany();

    for (const entry of inactiveEntries) {
      // Apply 5% decay per week of inactivity
      const daysSinceUpdate = Math.floor(
        (Date.now() -
          new Date(entry.metadata?.lastUpdated || entry.createdAt).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const weeksInactive = Math.floor(daysSinceUpdate / 7);
      const decayFactor = Math.pow(0.95, weeksInactive);

      const newScore = Math.floor(entry.score * decayFactor);

      if (newScore !== entry.score) {
        entry.score = newScore;
        entry.metadata = {
          ...entry.metadata,
          decayApplied: new Date().toISOString(),
          originalScore: entry.metadata?.originalScore || entry.score,
          decayFactor,
        };

        await this.entryRepository.save(entry);
        await this.recalculateRankingsWithTieBreaking(entry.leaderboardId);

        this.logger.log(
          `Applied decay to user ${entry.userId}: ${entry.score} -> ${newScore}`,
        );
      }
    }
  }

  async getUserRank(
    userId: string,
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string,
  ): Promise<number | null> {
    const leaderboard = await this.leaderboardRepository.findActiveLeaderboard(
      type,
      period,
      category,
    );
    if (!leaderboard) return null;

    const entry = await this.entryRepository.findOne({
      where: { userId, leaderboardId: leaderboard.id },
    });

    return entry?.rank || null;
  }

  async getUsersAroundRank(
    userId: string,
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string,
    range = 5,
  ): Promise<LeaderboardEntry[]> {
    const userRank = await this.getUserRank(userId, type, period, category);
    if (!userRank) return [];

    const leaderboard = await this.leaderboardRepository.findActiveLeaderboard(
      type,
      period,
      category,
    );
    if (!leaderboard) return [];

    const startRank = Math.max(1, userRank - range);
    const endRank = userRank + range;

    return this.entryRepository.find({
      where: {
        leaderboardId: leaderboard.id,
        rank: Between(startRank, endRank),
      },
      order: { rank: "ASC" },
    });
  }

  async getTopPlayers(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string,
    limit = 10,
  ): Promise<LeaderboardEntry[]> {
    const leaderboard = await this.leaderboardRepository.findActiveLeaderboard(
      type,
      period,
      category,
    );
    if (!leaderboard) return [];

    return this.entryRepository.find({
      where: { leaderboardId: leaderboard.id },
      order: { rank: "ASC" },
      take: limit,
    });
  }

  async getLeaderboardStats(
    type: LeaderboardType,
    period: LeaderboardPeriod,
    category: string,
  ): Promise<{
    totalPlayers: number;
    averageScore: number;
    topScore: number;
    lastUpdated: Date;
  }> {
    const leaderboard = await this.leaderboardRepository.findActiveLeaderboard(
      type,
      period,
      category,
    );
    if (!leaderboard) {
      return {
        totalPlayers: 0,
        averageScore: 0,
        topScore: 0,
        lastUpdated: new Date(),
      };
    }

    const stats = await this.entryRepository
      .createQueryBuilder("entry")
      .select("COUNT(*)", "totalPlayers")
      .addSelect("AVG(entry.score)", "averageScore")
      .addSelect("MAX(entry.score)", "topScore")
      .where("entry.leaderboardId = :leaderboardId", {
        leaderboardId: leaderboard.id,
      })
      .getRawOne();

    return {
      totalPlayers: parseInt(stats.totalPlayers) || 0,
      averageScore: parseFloat(stats.averageScore) || 0,
      topScore: parseInt(stats.topScore) || 0,
      lastUpdated: leaderboard.createdAt,
    };
  }

  async resetLeaderboard(leaderboardId: string): Promise<void> {
    await this.archiveLeaderboard(leaderboardId);

    const oldLeaderboard = await this.leaderboardRepository.findOne({
      where: { id: leaderboardId },
    });

    if (oldLeaderboard) {
      const newLeaderboard = this.leaderboardRepository.create({
        type: oldLeaderboard.type,
        period: oldLeaderboard.period,
        category: oldLeaderboard.category,
        startDate: new Date(),
        isActive: true,
      });

      await this.leaderboardRepository.save(newLeaderboard);
      this.logger.log(
        `Reset leaderboard ${leaderboardId}, created new: ${newLeaderboard.id}`,
      );
    }
  }
}
