import {
  IsNumber,
  IsOptional,
  IsUUID,
  IsBoolean,
  IsObject,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RecordMatchResultDto {
  @ApiProperty({ description: 'Home participant score' })
  @IsNumber()
  @Min(0)
  @Max(1000)
  homeScore: number;

  @ApiProperty({ description: 'Away participant score' })
  @IsNumber()
  @Min(0)
  @Max(1000)
  awayScore: number;

  @ApiPropertyOptional({ description: 'Winner participant ID' })
  @IsOptional()
  @IsUUID()
  winnerId?: string;

  @ApiPropertyOptional({ description: 'Is the match a draw', default: false })
  @IsOptional()
  @IsBoolean()
  isDraw?: boolean;

  @ApiPropertyOptional({ description: 'Additional match metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
