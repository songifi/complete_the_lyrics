import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  LeaderboardEntry,
  PersonalRanking,
} from "../interfaces/leaderboard.interface";

export class LeaderboardEntryDto implements LeaderboardEntry {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  score: number;

  @ApiProperty()
  rank: number;

  @ApiPropertyOptional()
  avatar?: string;

  @ApiProperty()
  lastUpdated: Date;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [LeaderboardEntryDto] })
  entries: LeaderboardEntryDto[];

  @ApiProperty()
  totalEntries: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiPropertyOptional()
  userRank?: number;
}

export class PersonalRankingDto implements PersonalRanking {
  @ApiProperty()
  currentRank: number;

  @ApiProperty()
  score: number;

  @ApiProperty()
  totalUsers: number;

  @ApiProperty()
  percentile: number;

  @ApiProperty()
  rankChange: number;
}

export class LeaderboardHistoryEntryDto {
  @ApiProperty()
  date: string;

  @ApiProperty()
  rank: number;

  @ApiProperty()
  score: number;

  @ApiProperty()
  period: string;
}
