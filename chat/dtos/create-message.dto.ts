// src/chat/dtos/create-message.dto.ts
import { IsString, IsOptional, IsArray } from 'class-validator';

export class CreateMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsArray()
  recipients?: string[];

  @IsOptional()
  roomId?: string;

  @IsOptional()
  isPrivate?: boolean;
}
