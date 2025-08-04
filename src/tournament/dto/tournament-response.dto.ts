import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import {
  TournamentFormat,
  TournamentStatus,
  ParticipantStatus,
  MatchStatus,
} from '../enums/tournament.enums';

export class ParticipantResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  playerId: string;

  @ApiPropertyOptional()
  @Expose()
  teamId?: string;

  @ApiProperty({ enum: ParticipantStatus })
  @Expose()
  status: ParticipantStatus;

  @ApiPropertyOptional()
  @Expose()
  seed?: number;

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

  @ApiPropertyOptional()
  @Expose()
  currentRank?: number;

  @ApiProperty()
  @Expose()
  registeredAt: Date;
}

export class MatchResponseDto {
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

  @ApiProperty({ enum: MatchStatus })
  @Expose()
  status: MatchStatus;

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
}

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

  @ApiProperty({ enum: TournamentFormat })
  @Expose()
  format: TournamentFormat;

  @ApiProperty({ enum: TournamentStatus })
  @Expose()
  status: TournamentStatus;

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

  @ApiProperty({ type: [ParticipantResponseDto] })
  @Type(() => ParticipantResponseDto)
  @Expose()
  participants: ParticipantResponseDto[];

  @ApiProperty({ type: [MatchResponseDto] })
  @Type(() => MatchResponseDto)
  @Expose()
  matches: MatchResponseDto[];

  @ApiProperty()
  @Expose()
  get participantCount(): number {
    return this.participants?.length || 0;
  }

  @ApiProperty()
  @Expose()
  get isRegistrationOpen(): boolean {
    const now = new Date();
    return (
      this.status === TournamentStatus.REGISTRATION_OPEN &&
      now >= this.registrationStartAt &&
      now <= this.registrationEndAt
    );
  }

  @ApiProperty()
  @Expose()
  get isFull(): boolean {
    return this.maxParticipants
      ? this.participantCount >= this.maxParticipants
      : false;
  }
}

export class PaginatedTournamentResponseDto {
  @ApiProperty({ type: [TournamentResponseDto] })
  @Type(() => TournamentResponseDto)
  data: TournamentResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNext: boolean;

  @ApiProperty()
  hasPrev: boolean;
}

export class BracketResponseDto {
  @ApiProperty()
  format: TournamentFormat;

  @ApiProperty()
  totalRounds: number;

  @ApiProperty()
  rounds: any[];

  @ApiPropertyOptional()
  metadata?: Record<string, any>;
}

export class LeaderboardResponseDto {
  @ApiProperty({ type: [ParticipantResponseDto] })
  @Type(() => ParticipantResponseDto)
  participants: ParticipantResponseDto[];

  @ApiProperty()
  lastUpdated: Date;
}
