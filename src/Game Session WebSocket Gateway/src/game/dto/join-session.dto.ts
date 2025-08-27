import { IsString, IsOptional, IsEnum } from "class-validator";
import { PlayerRole } from "../interfaces/player.interface";

export class JoinSessionDto {
  @IsString()
  sessionId: string;

  @IsString()
  username: string;

  @IsOptional()
  @IsEnum(PlayerRole)
  role?: PlayerRole = PlayerRole.PLAYER;

  @IsOptional()
  password?: string;
}
