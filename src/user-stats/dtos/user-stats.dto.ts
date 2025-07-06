import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Transform } from 'class-transformer';

export class LeaderboardQueryDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class UserStatsResponseDto {
  userId: number;
  totalAttempts: number;
  correctAttempts: number;
  score: number;
  accuracyRate: number;
  rank?: number;
  createdAt: Date;
  updatedAt: Date;
}