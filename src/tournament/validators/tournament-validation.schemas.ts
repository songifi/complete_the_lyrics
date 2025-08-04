import {
  IsString,
  IsEnum,
  IsNumber,
  IsDate,
  IsBoolean,
  IsOptional,
  ValidateNested,
  IsArray,
  Min,
  Max,
  IsUUID,
  IsEmail,
  IsObject,
  ValidationArguments,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import {
  TournamentFormat,
  TournamentStatus,
  ParticipantStatus,
  MatchStatus,
  PrizeType,
} from '../enums/tournament.enums';

// Custom validators
export function IsAfterDate(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAfterDate',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];
          return (
            value instanceof Date &&
            relatedValue instanceof Date &&
            value > relatedValue
          );
        },
        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          return `${args.property} must be after ${relatedPropertyName}`;
        },
      },
    });
  };
}

export function IsValidTournamentFormat(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidTournamentFormat',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return Object.values(TournamentFormat).includes(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid tournament format`;
        },
      },
    });
  };
}

export function IsValidParticipantCount(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidParticipantCount',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const tournament = args.object as CreateTournamentDto;

          if (
            tournament.format === TournamentFormat.SINGLE_ELIMINATION ||
            tournament.format === TournamentFormat.DOUBLE_ELIMINATION
          ) {
            // Power of 2 check for elimination tournaments
            return value && Math.log2(value) % 1 === 0;
          }

          if (tournament.format === TournamentFormat.ROUND_ROBIN) {
            // Round robin should have at least 3 participants
            return value >= 3;
          }

          return value >= 2;
        },
        defaultMessage(args: ValidationArguments) {
          const tournament = args.object as CreateTournamentDto;

          if (
            tournament.format === TournamentFormat.SINGLE_ELIMINATION ||
            tournament.format === TournamentFormat.DOUBLE_ELIMINATION
          ) {
            return 'Participant count must be a power of 2 for elimination tournaments';
          }

          return 'Invalid participant count for the selected tournament format';
        },
      },
    });
  };
}

// Base DTOs
export class CreateTournamentDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsEnum(TournamentFormat)
  @IsValidTournamentFormat()
  format: TournamentFormat;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1024)
  @IsValidParticipantCount()
  maxParticipants?: number;

  @IsOptional()
  @IsNumber()
  @Min(2)
  minParticipants: number = 2;

  @IsOptional()
  @IsNumber()
  @Min(0)
  entryFee?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  prizePool?: number;

  @IsDate()
  @Type(() => Date)
  registrationStartAt: Date;

  @IsDate()
  @Type(() => Date)
  @IsAfterDate('registrationStartAt')
  registrationEndAt: Date;

  @IsDate()
  @Type(() => Date)
  @IsAfterDate('registrationEndAt')
  startAt: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @IsAfterDate('startAt')
  endAt?: Date;

  @IsOptional()
  @IsObject()
  rules?: Record<string, any>;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TournamentSettingsDto)
  settings?: TournamentSettingsDto;

  @IsOptional()
  @IsBoolean()
  isPublic: boolean = true;

  @IsOptional()
  @IsBoolean()
  allowLateRegistration: boolean = false;

  @IsOptional()
  @IsBoolean()
  requireApproval: boolean = false;

  @IsOptional()
  @IsObject()
  seeding?: Record<string, any>;

  @IsUUID()
  createdBy: string;
}

export class TournamentSettingsDto {
  @IsOptional()
  @IsBoolean()
  allowBye?: boolean;

  @IsOptional()
  @IsBoolean()
  randomizeSeeds?: boolean;

  @IsOptional()
  @IsBoolean()
  autoAdvance?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(15)
  @Max(300)
  matchDuration?: number; // in minutes

  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(60)
  breakDuration?: number; // in minutes

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  roundDuration?: number; // in hours

  @IsOptional()
  @IsObject()
  tiebreakRules?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  banList?: string[];

  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  minAge?: number;

  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  maxAge?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minSkillLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSkillLevel?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedRegions?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedRegions?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  maxTeamSize?: number;

  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean;

  @IsOptional()
  @IsBoolean()
  autoCloseWhenFull?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrizeStructureDto)
  prizeStructure?: PrizeStructureDto[];
}

export class PrizeStructureDto {
  @IsNumber()
  @Min(1)
  rank: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedAmount?: number;

  @IsEnum(PrizeType)
  prizeType: PrizeType;

  @IsOptional()
  @IsObject()
  prizeData?: Record<string, any>;
}

export class UpdateTournamentDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  name?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  description?: string;

  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  registrationEndAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startAt?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endAt?: Date;

  @IsOptional()
  @IsObject()
  rules?: Record<string, any>;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => TournamentSettingsDto)
  settings?: TournamentSettingsDto;

  @IsOptional()
  @IsBoolean()
  allowLateRegistration?: boolean;

  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;
}

export class JoinTournamentDto {
  @IsUUID()
  tournamentId: string;

  @IsUUID()
  playerId: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ConfirmParticipantDto {
  @IsUUID()
  participantId: string;

  @IsOptional()
  @IsBoolean()
  approved?: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class MatchResultDto {
  @IsUUID()
  matchId: string;

  @IsNumber()
  @Min(0)
  homeScore: number;

  @IsNumber()
  @Min(0)
  awayScore: number;

  @IsOptional()
  @IsUUID()
  winnerId?: string;

  @IsOptional()
  @IsBoolean()
  isDraw?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ScheduleMatchDto {
  @IsUUID()
  matchId: string;

  @IsDate()
  @Type(() => Date)
  scheduledAt: Date;

  @IsOptional()
  @IsBoolean()
  forceSchedule?: boolean; // Override availability conflicts
}

export class BulkScheduleDto {
  @IsUUID()
  tournamentId: string;

  @IsNumber()
  @Min(1)
  round: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startFrom?: Date;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(300)
  matchInterval?: number; // minutes between matches
}

export class TournamentQueryDto {
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @IsOptional()
  @IsEnum(TournamentFormat)
  format?: TournamentFormat;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  sortBy?: 'startAt' | 'createdAt' | 'participantCount' | 'prizePool';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startAfter?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startBefore?: Date;
}

export class MatchQueryDto {
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsEnum(MatchStatus)
  status?: MatchStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  round?: number;

  @IsOptional()
  @IsUUID()
  participantId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class ParticipantQueryDto {
  @IsOptional()
  @IsUUID()
  tournamentId?: string;

  @IsOptional()
  @IsEnum(ParticipantStatus)
  status?: ParticipantStatus;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  sortBy?: 'points' | 'wins' | 'currentRank' | 'registeredAt';

  @IsOptional()
  @IsString()
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}

// Complex conditional validation schemas
export class CreateBracketedTournamentDto extends CreateTournamentDto {
  @IsValidParticipantCount({
    message:
      'Participant count must be a power of 2 for elimination tournaments',
  })
  maxParticipants: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => EliminationSettingsDto)
  settings?: EliminationSettingsDto;
}

export class EliminationSettingsDto extends TournamentSettingsDto {
  @IsOptional()
  @IsBoolean()
  allowBye: boolean = true;

  @IsOptional()
  @IsString()
  seedingMethod?: 'random' | 'skill' | 'manual' | 'registration_order';

  @IsOptional()
  @IsBoolean()
  thirdPlacePlayoff?: boolean;
}

export class CreateRoundRobinTournamentDto extends CreateTournamentDto {
  @IsNumber()
  @Min(3, {
    message: 'Round robin tournaments require at least 3 participants',
  })
  @Max(20, {
    message:
      'Round robin tournaments are limited to 20 participants for scheduling reasons',
  })
  maxParticipants: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RoundRobinSettingsDto)
  settings?: RoundRobinSettingsDto;
}

export class RoundRobinSettingsDto extends TournamentSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(3)
  roundsPerMatch?: number; // How many times each pair plays

  @IsOptional()
  @IsBoolean()
  doubleRoundRobin?: boolean; // Play each opponent twice

  @IsOptional()
  @IsString()
  pointSystem?: 'standard' | 'fifa' | 'custom'; // 3-1-0, different systems
}

export class CreateSwissTournamentDto extends CreateTournamentDto {
  @IsNumber()
  @Min(8, { message: 'Swiss tournaments require at least 8 participants' })
  maxParticipants: number;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => SwissSettingsDto)
  settings?: SwissSettingsDto;
}

export class SwissSettingsDto extends TournamentSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(15)
  numberOfRounds?: number;

  @IsOptional()
  @IsString()
  pairingMethod?: 'random' | 'dutch' | 'accelerated';

  @IsOptional()
  @IsBoolean()
  avoidRepeatPairings?: boolean;

  @IsOptional()
  @IsString()
  tiebreakMethod?: 'buchholz' | 'sonneborn_berger' | 'head_to_head';
}

// Validation groups
export class TournamentValidationGroups {
  static readonly CREATION = 'creation';
  static readonly UPDATE = 'update';
  static readonly START = 'start';
  static readonly PARTICIPANT_JOIN = 'participant_join';
  static readonly MATCH_RESULT = 'match_result';
  static readonly ADMIN_ACTION = 'admin_action';
}

// Complex validation decorators
export function ValidateTournamentState(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'validateTournamentState',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const dto = args.object as any;

          // State-specific validations
          switch (dto.status) {
            case TournamentStatus.REGISTRATION_OPEN:
              return (
                new Date() >= new Date(dto.registrationStartAt) &&
                new Date() <= new Date(dto.registrationEndAt)
              );

            case TournamentStatus.IN_PROGRESS:
              return new Date() >= new Date(dto.startAt);

            case TournamentStatus.COMPLETED:
              return dto.endAt && new Date() >= new Date(dto.endAt);

            default:
              return true;
          }
        },
        defaultMessage(args: ValidationArguments) {
          return `Tournament state validation failed for ${args.property}`;
        },
      },
    });
  };
}

export function ValidateMatchResult(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'validateMatchResult',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          const result = args.object as MatchResultDto;

          // Check if there's a winner when not a draw
          if (!result.isDraw && !result.winnerId) {
            return false;
          }

          // Check if winner ID matches the higher score
          if (result.winnerId && !result.isDraw) {
            if (result.homeScore > result.awayScore) {
              // Winner should be home participant (validated elsewhere)
              return true;
            } else if (result.awayScore > result.homeScore) {
              // Winner should be away participant (validated elsewhere)
              return true;
            } else {
              // Scores are equal but not marked as draw
              return false;
            }
          }

          // If it's a draw, scores should be equal
          if (result.isDraw && result.homeScore !== result.awayScore) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return 'Match result validation failed - inconsistent scores and winner';
        },
      },
    });
  };
}
