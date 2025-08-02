import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  Length,
  MaxLength,
  IsUUID,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RoomAccessType, RoomStatus } from '../enums';
import { RoomConfiguration } from '../interfaces';

export class UpdateRoomDto {
  @ApiPropertyOptional({
    description: 'Name of the room',
    example: 'Updated Room Name',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the room',
    example: 'Updated description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Room tag for easy discovery',
    example: 'rock-music',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;

  @ApiPropertyOptional({
    description: 'Room access type',
    enum: RoomAccessType,
    example: RoomAccessType.PRIVATE,
  })
  @IsOptional()
  @IsEnum(RoomAccessType)
  accessType?: RoomAccessType;

  @ApiPropertyOptional({
    description: 'Room status',
    enum: RoomStatus,
    example: RoomStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(RoomStatus)
  status?: RoomStatus;

  @ApiPropertyOptional({
    description: 'New password for the room',
    example: 'newSecretPassword',
    minLength: 6,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(6, 50)
  password?: string;

  @ApiPropertyOptional({
    description: 'Room configuration settings',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  configuration?: Partial<RoomConfiguration>;

  @ApiPropertyOptional({
    description: 'List of user IDs to invite',
    type: [String],
    example: ['user-id-1', 'user-id-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  invitedUsers?: string[];

  @ApiPropertyOptional({
    description: 'List of moderator user IDs',
    type: [String],
    example: ['moderator-id-1', 'moderator-id-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  moderators?: string[];

  @ApiPropertyOptional({
    description: 'Whether the room is locked',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isLocked?: boolean;

  @ApiPropertyOptional({
    description: 'Additional metadata for the room',
    type: 'object',
    example: { theme: 'light', newSetting: 'value' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
