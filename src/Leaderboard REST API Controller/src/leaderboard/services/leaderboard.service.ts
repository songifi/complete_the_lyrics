import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, SelectQueryBuilder } from "typeorm";
import { LeaderboardEntryEntity } from "../entities/leaderboard-entry.entity";
import { User } from "../../users/entities/user.entity";
import {
  LeaderboardQueryDto,
  FriendLeaderboardQueryDto,
  CreateShareableLeaderboardDto,
} from "../dto/leaderboard-query.dto";
import {
  LeaderboardResponse,
  LeaderboardEntry,
  PersonalRanking,
  ShareableLeaderboard,
  LeaderboardType,
} from "../interfaces/leaderboard.interface";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class LeaderboardService {
  private shareableLeaderboards = new Map<string, ShareableLeaderboard>();

  constructor(
    @InjectRepository(LeaderboardEntryEntity)
    private leaderboardRepository: Repository<LeaderboardEntryEntity>,
    @InjectRepository(User)
    private userRepository: Repository<User>
  ) {}

  async getGlobalLeaderboard(
    query: LeaderboardQueryDto
  ): Promise<LeaderboardResponse> {
    const { limit, page, search, userId, type, period } = query;
    const offset = (page - 1) * limit;

    let queryBuilder = this.buildBaseQuery(type, period);

    if (search) {
      queryBuilder = queryBuilder.andWhere(
        "LOWER(user.username) LIKE LOWER(:search)",
        { search: `%${search}%` }
      );
    }

    const [entries, totalEntries] = await Promise.all([
      queryBuilder.limit(limit).offset(offset).getRawAndEntities(),
      queryBuilder.getCount(),
    ]);

    const leaderboardEntries = await this.mapToLeaderboardEntries(
      entries.entities
    );

    let userRank: number | undefined;
    if (userId) {
      userRank = await this.getUserRank(userId, type, period);
    }

    return {
      entries: leaderboardEntries,
      totalEntries,
      page,
      limit,
      userRank,
    };
  }

  async getFriendLeaderboard(
    userId: string,
    query: FriendLeaderboardQueryDto
  ): Promise<LeaderboardResponse> {
    const { limit, page, friendIds, type, period } = query;
    const offset = (page - 1) * limit;

    // Get user's friends if not provided
    const targetFriendIds = friendIds || (await this.getUserFriends(userId));

    // Include the user themselves
    const allUserIds = [...targetFriendIds, userId];

    let queryBuilder = this.buildBaseQuery(type, period);
    queryBuilder = queryBuilder.andWhere("entry.userId IN (:...userIds)", {
      userIds: allUserIds,
    });

    const [entries, totalEntries] = await Promise.all([
      queryBuilder.limit(limit).offset(offset).getRawAndEntities(),
      queryBuilder.getCount(),
    ]);

    const leaderboardEntries = await this.mapToLeaderboardEntries(
      entries.entities
    );
    const userRank =
      leaderboardEntries.findIndex((entry) => entry.userId === userId) + 1;

    return {
      entries: leaderboardEntries,
      totalEntries,
      page,
      limit,
      userRank: userRank > 0 ? userRank : undefined,
    };
  }

  async getPersonalRanking(
    userId: string,
    type: LeaderboardType = LeaderboardType.GLOBAL
  ): Promise<PersonalRanking> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const currentEntry = await this.leaderboardRepository.findOne({
      where: { userId, leaderboardType: type },
    });

    if (!currentEntry) {
      throw new NotFoundException("User not found in leaderboard");
    }

    const totalUsers = await this.leaderboardRepository.count({
      where: { leaderboardType: type },
    });

    const currentRank = await this.getUserRank(userId, type);
    const percentile = Math.max(
      0,
      ((totalUsers - currentRank) / totalUsers) * 100
    );
    const rankChange = currentEntry.previousRank - currentRank;

    return {
      currentRank,
      score: currentEntry.score,
      totalUsers,
      percentile,
      rankChange,
    };
  }

  async searchLeaderboard(
    query: string,
    leaderboardQuery: LeaderboardQueryDto
  ): Promise<LeaderboardResponse> {
    return this.getGlobalLeaderboard({
      ...leaderboardQuery,
      search: query,
    });
  }

  async createShareableLeaderboard(
    creatorId: string,
    dto: CreateShareableLeaderboardDto
  ): Promise<{ shareId: string; shareUrl: string }> {
    const { title, description, userIds, expiresAt } = dto;

    // Validate users exist
    const users = await this.userRepository.findByIds(userIds);
    if (users.length !== userIds.length) {
      throw new BadRequestException("Some users not found");
    }

    // Get leaderboard entries for these users
    const entries = await this.leaderboardRepository
      .createQueryBuilder("entry")
      .leftJoinAndSelect("entry.user", "user")
      .where("entry.userId IN (:...userIds)", { userIds })
      .andWhere("entry.leaderboardType = :type", {
        type: LeaderboardType.GLOBAL,
      })
      .orderBy("entry.score", "DESC")
      .getMany();

    const leaderboardEntries = await this.mapToLeaderboardEntries(entries);

    const shareId = uuidv4();
    const shareableLeaderboard: ShareableLeaderboard = {
      id: shareId,
      title,
      description,
      entries: leaderboardEntries,
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };

    this.shareableLeaderboards.set(shareId, shareableLeaderboard);

    // Clean up expired shares (simple cleanup)
    this.cleanupExpiredShares();

    return {
      shareId,
      shareUrl: `${
        process.env.BASE_URL || "http://localhost:3000"
      }/api/leaderboard/shared/${shareId}`,
    };
  }

  async getShareableLeaderboard(
    shareId: string
  ): Promise<ShareableLeaderboard> {
    const shareableLeaderboard = this.shareableLeaderboards.get(shareId);

    if (!shareableLeaderboard) {
      throw new NotFoundException("Shared leaderboard not found");
    }

    if (
      shareableLeaderboard.expiresAt &&
      shareableLeaderboard.expiresAt < new Date()
    ) {
      this.shareableLeaderboards.delete(shareId);
      throw new NotFoundException("Shared leaderboard has expired");
    }

    return shareableLeaderboard;
  }

  private buildBaseQuery(
    type: LeaderboardType = LeaderboardType.GLOBAL,
    period: string = "all_time"
  ): SelectQueryBuilder<LeaderboardEntryEntity> {
    let queryBuilder = this.leaderboardRepository
      .createQueryBuilder("entry")
      .leftJoinAndSelect("entry.user", "user")
      .where("entry.leaderboardType = :type", { type })
      .orderBy("entry.score", "DESC")
      .addOrderBy("entry.updatedAt", "ASC"); // For tie-breaking

    // Add time-based filtering based on period
    if (period !== "all_time") {
      const date = this.getPeriodStartDate(period);
      queryBuilder = queryBuilder.andWhere("entry.updatedAt >= :date", {
        date,
      });
    }

    return queryBuilder;
  }

  private async mapToLeaderboardEntries(
    entities: LeaderboardEntryEntity[]
  ): Promise<LeaderboardEntry[]> {
    return entities.map((entry, index) => ({
      id: entry.id,
      userId: entry.userId,
      username: entry.user?.username || "Unknown",
      score: Number(entry.score),
      rank: index + 1, // Calculate rank based on order
      avatar: entry.user?.avatar,
      lastUpdated: entry.updatedAt,
    }));
  }

  private async getUserRank(
    userId: string,
    type: LeaderboardType = LeaderboardType.GLOBAL,
    period: string = "all_time"
  ): Promise<number> {
    const userEntry = await this.leaderboardRepository.findOne({
      where: { userId, leaderboardType: type },
    });

    if (!userEntry) {
      return 0;
    }

    let queryBuilder = this.leaderboardRepository
      .createQueryBuilder("entry")
      .where("entry.leaderboardType = :type", { type })
      .andWhere(
        "(entry.score > :score OR (entry.score = :score AND entry.updatedAt < :updatedAt))",
        {
          score: userEntry.score,
          updatedAt: userEntry.updatedAt,
        }
      );

    if (period !== "all_time") {
      const date = this.getPeriodStartDate(period);
      queryBuilder = queryBuilder.andWhere("entry.updatedAt >= :date", {
        date,
      });
    }

    const betterScores = await queryBuilder.getCount();
    return betterScores + 1;
  }

  private async getUserFriends(userId: string): Promise<string[]> {
    // This is a placeholder implementation
    // In a real app, you'd have a friends/relationships table
    // For now, return empty array
    return [];
  }

  private getPeriodStartDate(period: string): Date {
    const now = new Date();
    const startDate = new Date();

    switch (period) {
      case "daily":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "weekly":
        const dayOfWeek = now.getDay();
        startDate.setDate(now.getDate() - dayOfWeek);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "monthly":
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case "yearly":
        startDate.setMonth(0, 1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        return new Date(0); // Beginning of time
    }

    return startDate;
  }

  private cleanupExpiredShares(): void {
    const now = new Date();
    for (const [shareId, share] of this.shareableLeaderboards.entries()) {
      if (share.expiresAt && share.expiresAt < now) {
        this.shareableLeaderboards.delete(shareId);
      }
    }
  }

  // Method to update user scores (for when scores change)
  async updateUserScore(
    userId: string,
    score: number,
    type: LeaderboardType = LeaderboardType.GLOBAL
  ): Promise<LeaderboardEntryEntity> {
    let entry = await this.leaderboardRepository.findOne({
      where: { userId, leaderboardType: type },
    });

    if (entry) {
      entry.previousRank = entry.rank;
      entry.score = score;
    } else {
      entry = this.leaderboardRepository.create({
        userId,
        score,
        leaderboardType: type,
        rank: 0,
        previousRank: 0,
      });
    }

    await this.leaderboardRepository.save(entry);

    // Recalculate ranks for this leaderboard type
    await this.recalculateRanks(type);

    return entry;
  }

  private async recalculateRanks(type: LeaderboardType): Promise<void> {
    const entries = await this.leaderboardRepository.find({
      where: { leaderboardType: type },
      order: { score: "DESC", updatedAt: "ASC" },
    });

    for (let i = 0; i < entries.length; i++) {
      entries[i].rank = i + 1;
    }

    await this.leaderboardRepository.save(entries);
  }
}
