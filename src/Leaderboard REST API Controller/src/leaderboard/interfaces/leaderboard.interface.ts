export interface LeaderboardEntry {
  id: string;
  userId: string;
  username: string;
  score: number;
  rank: number;
  avatar?: string;
  lastUpdated: Date;
}

export interface LeaderboardResponse {
  entries: LeaderboardEntry[];
  totalEntries: number;
  page: number;
  limit: number;
  userRank?: number;
}

export interface PersonalRanking {
  currentRank: number;
  score: number;
  totalUsers: number;
  percentile: number;
  rankChange: number;
}

export interface ShareableLeaderboard {
  id: string;
  title: string;
  description?: string;
  entries: LeaderboardEntry[];
  createdAt: Date;
  expiresAt?: Date;
}

export enum LeaderboardType {
  GLOBAL = "global",
  FRIENDS = "friends",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  ALL_TIME = "all_time",
}

export enum LeaderboardPeriod {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  YEARLY = "yearly",
  ALL_TIME = "all_time",
}
