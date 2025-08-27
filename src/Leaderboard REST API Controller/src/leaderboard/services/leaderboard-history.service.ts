import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { LeaderboardHistoryEntity } from "../entities/leaderboard-history.entity";
import { LeaderboardHistoryQueryDto } from "../dto/leaderboard-query.dto";
import { LeaderboardHistoryEntryDto } from "../dto/leaderboard-response.dto";
import { LeaderboardPeriod } from "../interfaces/leaderboard.interface";

@Injectable()
export class LeaderboardHistoryService {
  constructor(
    @InjectRepository(LeaderboardHistoryEntity)
    private historyRepository: Repository<LeaderboardHistoryEntity>
  ) {}

  async getUserHistory(
    userId: string,
    query: LeaderboardHistoryQueryDto
  ): Promise<LeaderboardHistoryEntryDto[]> {
    const { period, days } = query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const entries = await this.historyRepository.find({
      where: {
        userId,
        period,
        date: Between(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
      },
      order: { date: "ASC" },
    });

    return entries.map((entry) => ({
      date: entry.date,
      rank: entry.rank,
      score: Number(entry.score),
      period: entry.period,
    }));
  }

  async getLeaderboardHistory(
    query: LeaderboardHistoryQueryDto,
    limit: number = 100
  ): Promise<LeaderboardHistoryEntryDto[]> {
    const { period, days } = query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const entries = await this.historyRepository
      .createQueryBuilder("history")
      .where("history.period = :period", { period })
      .andWhere("history.date BETWEEN :startDate AND :endDate", {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      })
      .orderBy("history.date", "ASC")
      .addOrderBy("history.rank", "ASC")
      .limit(limit)
      .getMany();

    return entries.map((entry) => ({
      date: entry.date,
      rank: entry.rank,
      score: Number(entry.score),
      period: entry.period,
    }));
  }

  async recordHistorySnapshot(
    userId: string,
    score: number,
    rank: number,
    period: LeaderboardPeriod
  ): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    // Check if entry already exists for today
    const existingEntry = await this.historyRepository.findOne({
      where: { userId, period, date: today },
    });

    if (existingEntry) {
      existingEntry.score = score;
      existingEntry.rank = rank;
      await this.historyRepository.save(existingEntry);
    } else {
      const historyEntry = this.historyRepository.create({
        userId,
        score,
        rank,
        period,
        date: today,
      });
      await this.historyRepository.save(historyEntry);
    }
  }
}
import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, Between } from "typeorm";
import { LeaderboardHistoryEntity } from "../entities/leaderboard-history.entity";
import { LeaderboardHistoryQueryDto } from "../dto/leaderboard-query.dto";
import { LeaderboardHistoryEntryDto } from "../dto/leaderboard-response.dto";
import { LeaderboardPeriod } from "../interfaces/leaderboard.interface";

@Injectable()
export class LeaderboardHistoryService {
  constructor(
    @InjectRepository(LeaderboardHistoryEntity)
    private historyRepository: Repository<LeaderboardHistoryEntity>
  ) {}

  async getUserHistory(
    userId: string,
    query: LeaderboardHistoryQueryDto
  ): Promise<LeaderboardHistoryEntryDto[]> {
    const { period, days } = query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const entries = await this.historyRepository.find({
      where: {
        userId,
        period,
        date: Between(
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0]
        ),
      },
      order: { date: "ASC" },
    });

    return entries.map((entry) => ({
      date: entry.date,
      rank: entry.rank,
      score: Number(entry.score),
      period: entry.period,
    }));
  }

  async getLeaderboardHistory(
    query: LeaderboardHistoryQueryDto,
    limit: number = 100
  ): Promise<LeaderboardHistoryEntryDto[]> {
    const { period, days } = query;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const entries = await this.historyRepository
      .createQueryBuilder("history")
      .where("history.period = :period", { period })
      .andWhere("history.date BETWEEN :startDate AND :endDate", {
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      })
      .orderBy("history.date", "ASC")
      .addOrderBy("history.rank", "ASC")
      .limit(limit)
      .getMany();

    return entries.map((entry) => ({
      date: entry.date,
      rank: entry.rank,
      score: Number(entry.score),
      period: entry.period,
    }));
  }

  async recordHistorySnapshot(
    userId: string,
    score: number,
    rank: number,
    period: LeaderboardPeriod
  ): Promise<void> {
    const today = new Date().toISOString().split("T")[0];

    // Check if entry already exists for today
    const existingEntry = await this.historyRepository.findOne({
      where: { userId, period, date: today },
    });

    if (existingEntry) {
      existingEntry.score = score;
      existingEntry.rank = rank;
      await this.historyRepository.save(existingEntry);
    } else {
      const historyEntry = this.historyRepository.create({
        userId,
        score,
        rank,
        period,
        date: today,
      });
      await this.historyRepository.save(historyEntry);
    }
  }
}
