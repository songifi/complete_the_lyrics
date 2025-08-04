import { IsString, IsOptional, IsEnum, IsUUID, IsArray, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RoomRole } from '../enums';

export class UpdateMemberRoleDto {
  @ApiProperty({
    description: 'ID of the user whose role to update',
    example: 'user-uuid',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'New role for the user',
    enum: RoomRole,
    example: RoomRole.MODERATOR,
  })
  @IsEnum(RoomRole)
  role: RoomRole;

  @ApiPropertyOptional({
    description: 'Additional permissions to grant',
    type: [String],
    example: ['manage_music', 'manage_settings'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];
}

export class InviteUsersDto {
  @ApiProperty({
    description: 'List of user IDs to invite',
    type: [String],
    example: ['user-id-1', 'user-id-2'],
  })
  @IsArray()
  @IsUUID('all', { each: true })
  userIds: string[];

  @ApiPropertyOptional({
    description: 'Custom invitation message',
    example: 'Join our exciting lyrics challenge room!',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;
}

export class RemoveUserDto {
  @ApiProperty({
    description: 'ID of the user to remove',
    example: 'user-uuid',
  })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description: 'Reason for removing the user',
    example: 'Requested to leave',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class TransferOwnershipDto {
  @ApiProperty({
    description: 'ID of the user to transfer ownership to',
    example: 'new-owner-uuid',
  })
  @IsUUID()
  newOwnerId: string;

  @ApiPropertyOptional({
    description: 'Reason for ownership transfer',
    example: 'Stepping down as room owner',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
