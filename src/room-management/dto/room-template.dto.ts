import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  Length,
  MaxLength,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomAccessType } from '../enums';
import { RoomConfiguration } from '../interfaces';

export class CreateRoomTemplateDto {
  @ApiProperty({
    description: 'Name of the template',
    example: 'Beginner Friendly Room',
    minLength: 3,
    maxLength: 100,
  })
  @IsString()
  @Length(3, 100)
  name: string;

  @ApiProperty({
    description: 'Description of the template',
    example: 'A template for beginner-friendly rooms with relaxed settings',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty({
    description: 'Category of the template',
    example: 'Beginner',
    maxLength: 50,
  })
  @IsString()
  @MaxLength(50)
  category: string;

  @ApiPropertyOptional({
    description: 'Whether the template is public',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean = true;

  @ApiProperty({
    description: 'Default access type for rooms created with this template',
    enum: RoomAccessType,
    example: RoomAccessType.PUBLIC,
  })
  @IsEnum(RoomAccessType)
  accessType: RoomAccessType;

  @ApiProperty({
    description: 'Template configuration settings',
    type: 'object',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  configuration: RoomConfiguration;

  @ApiPropertyOptional({
    description: 'Default roles for rooms created with this template',
    type: [String],
    example: ['member', 'moderator'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultRoles?: string[];

  @ApiPropertyOptional({
    description: 'Tags for categorizing the template',
    type: [String],
    example: ['beginner', 'casual', 'music'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateRoomTemplateDto {
  @ApiPropertyOptional({
    description: 'Name of the template',
    example: 'Updated Template Name',
    minLength: 3,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  name?: string;

  @ApiPropertyOptional({
    description: 'Description of the template',
    example: 'Updated description',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: 'Category of the template',
    example: 'Advanced',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({
    description: 'Whether the template is public',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({
    description: 'Default access type for rooms created with this template',
    enum: RoomAccessType,
    example: RoomAccessType.PRIVATE,
  })
  @IsOptional()
  @IsEnum(RoomAccessType)
  accessType?: RoomAccessType;

  @ApiPropertyOptional({
    description: 'Template configuration settings',
    type: 'object',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => Object)
  configuration?: Partial<RoomConfiguration>;

  @ApiPropertyOptional({
    description: 'Default roles for rooms created with this template',
    type: [String],
    example: ['member', 'moderator', 'vip'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  defaultRoles?: string[];

  @ApiPropertyOptional({
    description: 'Tags for categorizing the template',
    type: [String],
    example: ['advanced', 'competitive', 'music'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
