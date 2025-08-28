import { IsObject, IsOptional, IsString } from "class-validator";

export class SessionStateUpdateDto {
  @IsString()
  sessionId: string;

  @IsOptional()
  @IsObject()
  gameData?: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
