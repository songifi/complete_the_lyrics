import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  IsNumber,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModerationAction } from '../enums';

export class ModerationActionDto {
  @ApiProperty({
    description: 'ID of the user to moderate',
    example: 'user-uuid',
  })
  @IsUUID()
  targetUserId: string;

  @ApiProperty({
    description: 'Type of moderation action',
    enum: ModerationAction,
    example: ModerationAction.MUTE,
  })
  @IsEnum(ModerationAction)
  action: ModerationAction;

  @ApiPropertyOptional({
    description: 'Reason for the moderation action',
    example: 'Inappropriate language',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes for temporary actions (mute, ban)',
    example: 60,
    minimum: 1,
    maximum: 43200, // 30 days
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(43200)
  duration?: number;
}

export class KickUserDto {
  @ApiProperty({
    description: 'ID of the user to kick',
    example: 'user-uuid',
  })
  @IsUUID()
  targetUserId: string;

  @ApiPropertyOptional({
    description: 'Reason for kicking the user',
    example: 'Disruptive behavior',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class BanUserDto {
  @ApiProperty({
    description: 'ID of the user to ban',
    example: 'user-uuid',
  })
  @IsUUID()
  targetUserId: string;

  @ApiPropertyOptional({
    description: 'Reason for banning the user',
    example: 'Violation of room rules',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes for temporary ban',
    example: 1440, // 24 hours
    minimum: 1,
    maximum: 43200, // 30 days
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(43200)
  duration?: number;
}

export class MuteUserDto {
  @ApiProperty({
    description: 'ID of the user to mute',
    example: 'user-uuid',
  })
  @IsUUID()
  targetUserId: string;

  @ApiPropertyOptional({
    description: 'Reason for muting the user',
    example: 'Spam messages',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    description: 'Duration in minutes for mute',
    example: 30,
    minimum: 1,
    maximum: 43200, // 30 days
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(43200)
  duration?: number;
}

export class UnbanUserDto {
  @ApiProperty({
    description: 'ID of the user to unban',
    example: 'user-uuid',
  })
  @IsUUID()
  targetUserId: string;

  @ApiPropertyOptional({
    description: 'Reason for unbanning the user',
    example: 'Appeal accepted',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UnmuteUserDto {
  @ApiProperty({
    description: 'ID of the user to unmute',
    example: 'user-uuid',
  })
  @IsUUID()
  targetUserId: string;

  @ApiPropertyOptional({
    description: 'Reason for unmuting the user',
    example: 'Time served',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
