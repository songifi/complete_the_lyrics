import { IsEnum, IsString, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LeaderboardType, LeaderboardPeriod } from '../entities/leaderboard.entity';

export class UpdateScoreDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Score to update', minimum: 0 })
  @IsNumber()
  @Min(0)
  score: number;

  @ApiProperty({ enum: LeaderboardType, description: 'Leaderboard type' })
  @IsEnum(LeaderboardType)
  type: LeaderboardType;

  @ApiProperty({ enum: LeaderboardPeriod, description: 'Time period' })
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod;

  @ApiProperty({ description: 'Leaderboard category' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ description: 'Additional metadata', type: 'object' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class GetRankingsDto {
  @ApiProperty({ enum: LeaderboardType, description: 'Leaderboard type' })
  @IsEnum(LeaderboardType)
  type: LeaderboardType;

  @ApiProperty({ enum: LeaderboardPeriod, description: 'Time period' })
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod;

  @ApiProperty({ description: 'Leaderboard category' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ description: 'Number of entries to return', minimum: 1, maximum: 1000, default: 100 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(1000)
  limit?: number = 100;
}

export class GetUserRankDto {
  @ApiProperty({ description: 'User ID' })
  @IsUUID()
  userId: string;

  @ApiProperty({ enum: LeaderboardType, description: 'Leaderboard type' })
  @IsEnum(LeaderboardType)
  type: LeaderboardType;

  @ApiProperty({ enum: LeaderboardPeriod, description: 'Time period' })
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod;

  @ApiProperty({ description: 'Leaderboard category' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ description: 'Range around user rank', minimum: 1, maximum: 50, default: 5 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  range?: number = 5;
}

export class LeaderboardStatsDto {
  @ApiProperty({ enum: LeaderboardType, description: 'Leaderboard type' })
  @IsEnum(LeaderboardType)
  type: LeaderboardType;

  @ApiProperty({ enum: LeaderboardPeriod, description: 'Time period' })
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod;

  @ApiProperty({ description: 'Leaderboard category' })
  @IsString()
  category: string;
}

export class LeaderboardSubscriptionDto {
  @ApiProperty({ enum: LeaderboardType, description: 'Leaderboard type' })
  @IsEnum(LeaderboardType)
  type: LeaderboardType;

  @ApiProperty({ enum: LeaderboardPeriod, description: 'Time period' })
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod;

  @ApiProperty({ description: 'Leaderboard category' })
  @IsString()
  category: string;

  @ApiPropertyOptional({ description: 'Number of top players to include', minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class ResetLeaderboardDto {
  @ApiProperty({ description: 'Leaderboard ID to reset' })
  @IsUUID()
  leaderboardId: string;
}

export class ResetPeriodDto {
  @ApiProperty({ enum: LeaderboardPeriod, description: 'Period to reset' })
  @IsEnum(LeaderboardPeriod)
  period: LeaderboardPeriod;
}

// Response DTOs
export class LeaderboardEntryResponseDto {
  @ApiProperty({ description: 'Entry ID' })
  id: string;

  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Current rank' })
  rank: number;

  @ApiProperty({ description: 'Score' })
  score: number;

  @ApiProperty({ description: 'Additional metadata', required: false })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Entry creation date' })
  createdAt: Date;
}

export class UserRankResponseDto {
  @ApiProperty({ description: 'User rank', nullable: true })
  rank: number | null;

  @ApiProperty({ type: [LeaderboardEntryResponseDto], description: 'Users around this rank' })
  usersAround: LeaderboardEntryResponseDto[];
}

export class LeaderboardStatsResponseDto {
  @ApiProperty({ description: 'Total number of players' })
  totalPlayers: number;

  @ApiProperty({ description: 'Average score' })
  averageScore: number;

  @ApiProperty({ description: 'Highest score' })
  topScore: number;

  @ApiProperty({ description: 'Last update timestamp' })
  lastUpdated: Date;
}

export class SuccessResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ description: 'Response message' })
  message: string;
}

export class AvailablePeriodsResponseDto {
  @ApiProperty({ 
    type: [String], 
    enum: LeaderboardPeriod,
    description: 'Available leaderboard periods' 
  })
  periods: LeaderboardPeriod[];
}

export class AvailableTypesResponseDto {
  @ApiProperty({ 
    type: [String], 
    enum: LeaderboardType,
    description: 'Available leaderboard types' 
  })
  types: LeaderboardType[];
}
