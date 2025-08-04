import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  Length,
  MaxLength,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomAccessType } from '../enums';
import { RoomConfiguration } from '../interfaces';

export class CreateRoomDto {
  @ApiProperty({
    description: 'Name of the room',
    example: 'My Awesome Room',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @Length(3, 100)
  name: string;

  @ApiPropertyOptional({
    description: 'Description of the room',
    example: 'A fun room for lyrics challenges',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Room tag for easy discovery',
    example: 'pop-music',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tag?: string;

  @ApiProperty({
    description: 'Room access type',
    enum: RoomAccessType,
    example: RoomAccessType.PUBLIC,
  })
  @IsEnum(RoomAccessType)
  accessType: RoomAccessType;

  @ApiPropertyOptional({
    description: 'Password for password-protected rooms',
    example: 'mySecretPassword',
    minLength: 6,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(6, 50)
  password?: string;

  @ApiProperty({
    description: 'Room configuration settings',
    type: 'object',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  configuration: RoomConfiguration;

  @ApiPropertyOptional({
    description: 'List of user IDs to invite (for private rooms)',
    type: [String],
    example: ['user-id-1', 'user-id-2'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  invitedUsers?: string[];

  @ApiPropertyOptional({
    description: 'Template ID to use for room creation',
    example: 'template-uuid',
  })
  @IsOptional()
  @IsUUID()
  templateId?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the room',
    type: 'object',
    example: { theme: 'dark', customSetting: 'value' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
