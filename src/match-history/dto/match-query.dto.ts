import { IsOptional, IsString, IsEnum, IsDateString, IsInt, Min } from "class-validator"
import { GameMode } from "../entities/match-history.entity"
import { Type } from "class-transformer"

export class MatchQueryDto {
  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsEnum(GameMode)
  gameMode?: GameMode

  @IsOptional()
  @IsString()
  mapName?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0
}
