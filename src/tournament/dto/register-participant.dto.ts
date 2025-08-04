import { IsString, IsOptional, IsUUID, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterParticipantDto {
  @ApiProperty({ description: 'Player ID' })
  @IsString()
  @IsUUID()
  playerId: string;

  @ApiPropertyOptional({ description: 'Team ID for team tournaments' })
  @IsOptional()
  @IsString()
  @IsUUID()
  teamId?: string;

  @ApiPropertyOptional({ description: 'Additional registration metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
