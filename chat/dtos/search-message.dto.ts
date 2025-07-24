// src/chat/dtos/search-message.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchMessageDto {
  @IsString()
  query: string;

  @IsOptional()
  roomId?: string;

  @IsOptional()
  userId?: string;

  @IsOptional()
  isPrivate?: boolean;

  @IsOptional()
  @Type(() => Date)
  fromDate?: Date;

  @IsOptional()
  @Type(() => Date)
  toDate?: Date;
}
