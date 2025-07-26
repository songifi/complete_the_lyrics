import { IsString, IsInt, IsArray, IsOptional } from 'class-validator';

export class SessionAnalyticsDto {
  @IsString()
  sessionId: string;

  @IsInt()
  duration: number;

  @IsArray()
  @IsOptional()
  playerIds?: string[];

  @IsInt()
  completionRate: number;

  @IsArray()
  @IsOptional()
  playerActions?: any[];
}
