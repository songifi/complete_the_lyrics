import {
  IsString,
  IsOptional,
  IsArray,
  IsUUID,
  MaxLength,
  IsDateString,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateShareableLeaderboardDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty()
  @IsArray()
  @IsUUID("4", { each: true })
  userIds: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class ShareLeaderboardResponseDto {
  @ApiProperty()
  shareId: string;

  @ApiProperty()
  shareUrl: string;

  @ApiProperty()
  title: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  expiresAt?: Date;
}
