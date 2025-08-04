import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsObject,
  ValidateNested,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TournamentFormat } from '../enums/tournament.enums';

class TournamentRulesDto {
  @ApiPropertyOptional({ description: 'Maximum match duration in minutes' })
  @IsOptional()
  @IsNumber()
  @Min(5)
  @Max(300)
  matchDuration?: number;

  @ApiPropertyOptional({
    description: 'Break duration between matches in minutes',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  breakDuration?: number;

  @ApiPropertyOptional({ description: 'Allow late registration' })
  @IsOptional()
  @IsBoolean()
  allowLateRegistration?: boolean;

  @ApiPropertyOptional({
    description: 'Require manual approval for participants',
  })
  @IsOptional()
  @IsBoolean()
  requireApproval?: boolean;

  @ApiPropertyOptional({ description: 'Additional custom rules' })
  @IsOptional()
  @IsObject()
  customRules?: Record<string, any>;
}

class TournamentSettingsDto {
  @ApiPropertyOptional({ description: 'Minimum age requirement' })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  minAge?: number;

  @ApiPropertyOptional({ description: 'Maximum age requirement' })
  @IsOptional()
  @IsNumber()
  @Min(13)
  @Max(100)
  maxAge?: number;

  @ApiPropertyOptional({ description: 'Minimum skill level requirement' })
  @IsOptional()
  @IsNumber()
  minSkillLevel?: number;

  @ApiPropertyOptional({ description: 'Maximum skill level requirement' })
  @IsOptional()
  @IsNumber()
  maxSkillLevel?: number;

  @ApiPropertyOptional({ description: 'Allowed regions', type: [String] })
  @IsOptional()
  @IsString({ each: true })
  allowedRegions?: string[];

  @ApiPropertyOptional({ description: 'Blocked regions', type: [String] })
  @IsOptional()
  @IsString({ each: true })
  blockedRegions?: string[];

  @ApiPropertyOptional({
    description: 'Maximum team size for team tournaments',
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxTeamSize?: number;

  @ApiPropertyOptional({ description: 'Require account verification' })
  @IsOptional()
  @IsBoolean()
  requiresVerification?: boolean;
}

export class CreateTournamentDto {
  @ApiProperty({ description: 'Tournament name' })
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Tournament description' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiProperty({ description: 'Tournament format', enum: TournamentFormat })
  @IsEnum(TournamentFormat)
  format: TournamentFormat;

  @ApiPropertyOptional({ description: 'Maximum number of participants' })
  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(1024)
  maxParticipants?: number;

  @ApiProperty({ description: 'Minimum number of participants', default: 2 })
  @IsNumber()
  @Min(2)
  @Max(1024)
  minParticipants: number = 2;

  @ApiPropertyOptional({ description: 'Entry fee amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  entryFee?: number;

  @ApiPropertyOptional({ description: 'Total prize pool amount' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Transform(({ value }) => parseFloat(value))
  prizePool?: number;

  @ApiProperty({ description: 'Registration start date and time' })
  @IsDateString()
  registrationStartAt: string;

  @ApiProperty({ description: 'Registration end date and time' })
  @IsDateString()
  registrationEndAt: string;

  @ApiProperty({ description: 'Tournament start date and time' })
  @IsDateString()
  startAt: string;

  @ApiPropertyOptional({ description: 'Tournament rules' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TournamentRulesDto)
  rules?: TournamentRulesDto;

  @ApiPropertyOptional({ description: 'Tournament settings' })
  @IsOptional()
  @ValidateNested()
  @Type(() => TournamentSettingsDto)
  settings?: TournamentSettingsDto;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Is tournament public', default: true })
  @IsBoolean()
  isPublic: boolean = true;

  @ApiProperty({ description: 'Allow late registration', default: false })
  @IsBoolean()
  allowLateRegistration: boolean = false;

  @ApiProperty({
    description: 'Require approval for participants',
    default: false,
  })
  @IsBoolean()
  requireApproval: boolean = false;

  @ApiPropertyOptional({ description: 'Custom seeding configuration' })
  @IsOptional()
  @IsObject()
  seeding?: Record<string, any>;
}
