import { IsString, IsOptional, IsEnum } from "class-validator";

export enum MessageType {
  CHAT = "chat",
  SYSTEM = "system",
  GAME = "game",
}

export class ChatMessageDto {
  @IsString()
  content: string;

  @IsOptional()
  @IsEnum(MessageType)
  type?: MessageType = MessageType.CHAT;

  @IsOptional()
  @IsString()
  targetPlayerId?: string;
}
