import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Expose, Type, Transform } from 'class-transformer';
import {
  CreateTournamentDto,
  UpdateTournamentDto,
  JoinTournamentDto,
  MatchResultDto,
  TournamentQueryDto,
  MatchQueryDto,
  ParticipantQueryDto,
  ScheduleMatchDto,
  BulkScheduleDto,
  ConfirmParticipantDto,
  TournamentSettingsDto,
  PrizeStructureDto,
} from '../validators/tournament-validation.schemas';

// Response DTOs
export class TournamentResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional()
  @Expose()
  description?: string;

  @ApiProperty({
    enum: [
      'SINGLE_ELIMINATION',
      'DOUBLE_ELIMINATION',
      'ROUND_ROBIN',
      'SWISS_SYSTEM',
    ],
  })
  @Expose()
  format: string;

  @ApiProperty({
    enum: [
      'DRAFT',
      'REGISTRATION_OPEN',
      'REGISTRATION_CLOSED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ],
  })
  @Expose()
  status: string;

  @ApiPropertyOptional()
  @Expose()
  maxParticipants?: number;

  @ApiProperty()
  @Expose()
  minParticipants: number;

  @ApiPropertyOptional()
  @Expose()
  entryFee?: number;

  @ApiPropertyOptional()
  @Expose()
  prizePool?: number;

  @ApiProperty()
  @Expose()
  registrationStartAt: Date;

  @ApiProperty()
  @Expose()
  registrationEndAt: Date;

  @ApiProperty()
  @Expose()
  startAt: Date;

  @ApiPropertyOptional()
  @Expose()
  endAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  rules?: Record<string, any>;

  @ApiPropertyOptional()
  @Expose()
  settings?: Record<string, any>;

  @ApiProperty()
  @Expose()
  isPublic: boolean;

  @ApiProperty()
  @Expose()
  allowLateRegistration: boolean;

  @ApiProperty()
  @Expose()
  requireApproval: boolean;

  @ApiProperty()
  @Expose()
  createdBy: string;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @ApiProperty()
  @Expose()
  participantCount: number;

  @ApiProperty()
  @Expose()
  isFull: boolean;

  @ApiProperty()
  @Expose()
  canRegister: boolean;

  @ApiPropertyOptional({ type: [TournamentParticipantResponseDto] })
  @Expose()
  @Type(() => TournamentParticipantResponseDto)
  participants?: TournamentParticipantResponseDto[];

  @ApiPropertyOptional({ type: [MatchResponseDto] })
  @Expose()
  @Type(() => MatchResponseDto)
  matches?: MatchResponseDto[];
}

export class TournamentParticipantResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  tournamentId: string;

  @ApiProperty()
  @Expose()
  playerId: string;

  @ApiPropertyOptional()
  @Expose()
  teamId?: string;

  @ApiProperty({
    enum: [
      'REGISTERED',
      'CONFIRMED',
      'ACTIVE',
      'ELIMINATED',
      'WITHDRAWN',
      'DISQUALIFIED',
    ],
  })
  @Expose()
  status: string;

  @ApiPropertyOptional()
  @Expose()
  seed?: number;

  @ApiProperty()
  @Expose()
  registeredAt: Date;

  @ApiPropertyOptional()
  @Expose()
  confirmedAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  eliminatedAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  eliminatedInRound?: number;

  @ApiPropertyOptional()
  @Expose()
  currentRank?: number;

  @ApiProperty()
  @Expose()
  points: number;

  @ApiProperty()
  @Expose()
  wins: number;

  @ApiProperty()
  @Expose()
  losses: number;

  @ApiProperty()
  @Expose()
  draws: number;

  @ApiProperty()
  @Expose()
  totalMatches: number;

  @ApiProperty()
  @Expose()
  winRate: number;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  isEliminated: boolean;

  @ApiPropertyOptional()
  @Expose()
  metadata?: Record<string, any>;
}

export class MatchResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  tournamentId: string;

  @ApiPropertyOptional()
  @Expose()
  bracketId?: string;

  @ApiProperty()
  @Expose()
  round: number;

  @ApiProperty()
  @Expose()
  matchNumber: number;

  @ApiPropertyOptional()
  @Expose()
  homeParticipantId?: string;

  @ApiPropertyOptional()
  @Expose()
  awayParticipantId?: string;

  @ApiProperty({
    enum: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED'],
  })
  @Expose()
  status: string;

  @ApiPropertyOptional()
  @Expose()
  scheduledAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  startedAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  completedAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  homeScore?: number;

  @ApiPropertyOptional()
  @Expose()
  awayScore?: number;

  @ApiPropertyOptional()
  @Expose()
  winnerId?: string;

  @ApiProperty()
  @Expose()
  isDraw: boolean;

  @ApiProperty()
  @Expose()
  isCompleted: boolean;

  @ApiProperty()
  @Expose()
  hasWinner: boolean;

  @ApiPropertyOptional()
  @Expose()
  duration?: number;

  @ApiPropertyOptional()
  @Expose()
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  @Expose()
  notes?: string;

  @ApiPropertyOptional({ type: TournamentParticipantResponseDto })
  @Expose()
  @Type(() => TournamentParticipantResponseDto)
  homeParticipant?: TournamentParticipantResponseDto;

  @ApiPropertyOptional({ type: TournamentParticipantResponseDto })
  @Expose()
  @Type(() => TournamentParticipantResponseDto)
  awayParticipant?: TournamentParticipantResponseDto;

  @ApiPropertyOptional({ type: [MatchResultResponseDto] })
  @Expose()
  @Type(() => MatchResultResponseDto)
  results?: MatchResultResponseDto[];
}

export class MatchResultResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  matchId: string;

  @ApiProperty()
  @Expose()
  participantId: string;

  @ApiProperty()
  @Expose()
  score: number;

  @ApiPropertyOptional()
  @Expose()
  performance?: Record<string, any>;

  @ApiProperty()
  @Expose()
  recordedAt: Date;

  @ApiPropertyOptional({ type: TournamentParticipantResponseDto })
  @Expose()
  @Type(() => TournamentParticipantResponseDto)
  participant?: TournamentParticipantResponseDto;
}

export class BracketResponseDto {
  @ApiProperty()
  @Expose()
  format: string;

  @ApiProperty()
  @Expose()
  totalRounds: number;

  @ApiProperty({ type: [RoundResponseDto] })
  @Expose()
  @Type(() => RoundResponseDto)
  rounds: RoundResponseDto[];

  @ApiPropertyOptional()
  @Expose()
  metadata?: Record<string, any>;
}

export class RoundResponseDto {
  @ApiProperty()
  @Expose()
  roundNumber: number;

  @ApiProperty()
  @Expose()
  isCompleted: boolean;

  @ApiPropertyOptional()
  @Expose()
  startDate?: Date;

  @ApiPropertyOptional()
  @Expose()
  endDate?: Date;

  @ApiProperty({ type: [BracketMatchResponseDto] })
  @Expose()
  @Type(() => BracketMatchResponseDto)
  matches: BracketMatchResponseDto[];
}

export class BracketMatchResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  round: number;

  @ApiProperty()
  @Expose()
  matchNumber: number;

  @ApiPropertyOptional()
  @Expose()
  homeParticipantId?: string;

  @ApiPropertyOptional()
  @Expose()
  awayParticipantId?: string;

  @ApiPropertyOptional()
  @Expose()
  winnerId?: string;

  @ApiPropertyOptional()
  @Expose()
  homeScore?: number;

  @ApiPropertyOptional()
  @Expose()
  awayScore?: number;

  @ApiProperty()
  @Expose()
  status: string;

  @ApiPropertyOptional()
  @Expose()
  nextMatchId?: string;

  @ApiPropertyOptional()
  @Expose()
  previousMatch1Id?: string;

  @ApiPropertyOptional()
  @Expose()
  previousMatch2Id?: string;

  @ApiPropertyOptional()
  @Expose()
  position?: string;
}

export class PrizeDistributionResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  tournamentId: string;

  @ApiProperty()
  @Expose()
  rank: number;

  @ApiProperty()
  @Expose()
  prizeAmount: number;

  @ApiProperty()
  @Expose()
  prizeType: string;

  @ApiPropertyOptional()
  @Expose()
  prizeData?: Record<string, any>;

  @ApiPropertyOptional()
  @Expose()
  winnerId?: string;

  @ApiPropertyOptional()
  @Expose()
  distributedAt?: Date;

  @ApiProperty()
  @Expose()
  isDistributed: boolean;

  @ApiProperty()
  @Expose()
  createdAt: Date;
}

export class TournamentStatsResponseDto {
  @ApiProperty()
  @Expose()
  tournamentId: string;

  @ApiProperty()
  @Expose()
  totalParticipants: number;

  @ApiProperty()
  @Expose()
  totalMatches: number;

  @ApiProperty()
  @Expose()
  completedMatches: number;

  @ApiProperty()
  @Expose()
  currentRound: number;

  @ApiProperty()
  @Expose()
  estimatedDuration: number; // in minutes

  @ApiProperty()
  @Expose()
  averageMatchDuration: number; // in minutes

  @ApiPropertyOptional()
  @Expose()
  completionPercentage?: number;

  @ApiProperty()
  @Expose()
  activeMatches: number;

  @ApiProperty()
  @Expose()
  upcomingMatches: number;

  @ApiProperty()
  @Expose()
  viewerCount: number;

  @ApiProperty()
  @Expose()
  lastUpdated: Date;
}

export class TournamentListResponseDto {
  @ApiProperty({ type: [TournamentResponseDto] })
  @Expose()
  @Type(() => TournamentResponseDto)
  tournaments: TournamentResponseDto[];

  @ApiProperty()
  @Expose()
  total: number;

  @ApiProperty()
  @Expose()
  page: number;

  @ApiProperty()
  @Expose()
  limit: number;

  @ApiProperty()
  @Expose()
  hasNext: boolean;

  @ApiProperty()
  @Expose()
  hasPrevious: boolean;
}

export class LeaderboardResponseDto {
  @ApiProperty()
  @Expose()
  tournamentId: string;

  @ApiProperty({ type: [TournamentParticipantResponseDto] })
  @Expose()
  @Type(() => TournamentParticipantResponseDto)
  participants: TournamentParticipantResponseDto[];

  @ApiProperty()
  @Expose()
  lastUpdated: Date;
}

// Error response DTOs
export class ErrorResponseDto {
  @ApiProperty()
  @Expose()
  statusCode: number;

  @ApiProperty()
  @Expose()
  message: string;

  @ApiPropertyOptional()
  @Expose()
  error?: string;

  @ApiPropertyOptional()
  @Expose()
  timestamp?: string;

  @ApiPropertyOptional()
  @Expose()
  path?: string;
}

export class ValidationErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({ type: [String] })
  @Expose()
  details: string[];
}

// Success response DTOs
export class SuccessResponseDto {
  @ApiProperty()
  @Expose()
  success: boolean;

  @ApiProperty()
  @Expose()
  message: string;

  @ApiPropertyOptional()
  @Expose()
  data?: any;

  @ApiProperty()
  @Expose()
  timestamp: string;
}

// Websocket event DTOs
export class WebSocketEventDto {
  @ApiProperty()
  @Expose()
  type: string;

  @ApiProperty()
  @Expose()
  data: any;

  @ApiProperty()
  @Expose()
  timestamp: Date;

  @ApiPropertyOptional()
  @Expose()
  tournamentId?: string;

  @ApiPropertyOptional()
  @Expose()
  matchId?: string;
}

// Export all validation DTOs
export {
  CreateTournamentDto,
  UpdateTournamentDto,
  JoinTournamentDto,
  MatchResultDto,
  TournamentQueryDto,
  MatchQueryDto,
  ParticipantQueryDto,
  ScheduleMatchDto,
  BulkScheduleDto,
  ConfirmParticipantDto,
  TournamentSettingsDto,
  PrizeStructureDto,
};

// Re-export complex validation DTOs
export {
  CreateBracketedTournamentDto,
  CreateRoundRobinTournamentDto,
  CreateSwissTournamentDto,
} from '../validators/tournament-validation.schemas';
