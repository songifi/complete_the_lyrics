import {
  IsString,
  IsEnum,
  IsDateString,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
} from "class-validator"
import { Type } from "class-transformer"
import { GameMode, type PlayerResult, type MatchEvent } from "../entities/match-history.entity"

class CreatePlayerResultDto implements PlayerResult {
  @IsString()
  userId: string

  @IsOptional()
  @IsString()
  teamId?: string

  @IsInt()
  @Min(0)
  score: number

  @IsInt()
  @Min(0)
  kills: number

  @IsInt()
  @Min(0)
  deaths: number

  @IsInt()
  @Min(0)
  assists: number

  @IsInt()
  @Min(0)
  damageDealt: number

  @IsInt()
  @Min(0)
  damageTaken: number

  @IsInt()
  @Min(0)
  healingDone: number

  @IsInt()
  @Min(0)
  objectiveScore: number

  @IsOptional()
  @IsObject()
  performanceMetrics: Record<string, any>

  @IsOptional()
  @IsObject()
  equipment?: Record<string, any>

  @IsOptional()
  @IsObject()
  abilitiesUsed?: Record<string, number>
}

class CreateMatchEventDto implements MatchEvent {
  @IsInt()
  @Min(0)
  timestamp: number

  @IsString()
  eventType: string

  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsString()
  targetUserId?: string

  @IsObject()
  data: Record<string, any>
}

export class CreateMatchHistoryDto {
  @IsEnum(GameMode)
  gameMode: GameMode

  @IsString()
  mapName: string

  @IsDateString()
  startTime: string

  @IsDateString()
  endTime: string

  @IsInt()
  @Min(0)
  duration: number

  @IsOptional()
  @IsString()
  winningTeamId?: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePlayerResultDto)
  playerResults: CreatePlayerResultDto[]

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMatchEventDto)
  replayData?: CreateMatchEventDto[]

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
