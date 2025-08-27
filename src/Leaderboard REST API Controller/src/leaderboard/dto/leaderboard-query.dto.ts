import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsString,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  LeaderboardType,
  LeaderboardPeriod,
} from "../interfaces/leaderboard.interface";

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    enum: LeaderboardType,
    default: LeaderboardType.GLOBAL,
  })
  @IsOptional()
  @IsEnum(LeaderboardType)
  type?: LeaderboardType = LeaderboardType.GLOBAL;

  @ApiPropertyOptional({
    enum: LeaderboardPeriod,
    default: LeaderboardPeriod.ALL_TIME,
  })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period?: LeaderboardPeriod = LeaderboardPeriod.ALL_TIME;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;
}

export class FriendLeaderboardQueryDto extends LeaderboardQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID("4", { each: true })
  friendIds?: string[];
}

export class LeaderboardHistoryQueryDto {
  @ApiPropertyOptional({
    enum: LeaderboardPeriod,
    default: LeaderboardPeriod.WEEKLY,
  })
  @IsOptional()
  @IsEnum(LeaderboardPeriod)
  period?: LeaderboardPeriod = LeaderboardPeriod.WEEKLY;

  @ApiPropertyOptional({ minimum: 1, maximum: 365, default: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}
