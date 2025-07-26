import { IsString } from 'class-validator';

export class JoinSessionDto {
  @IsString()
  sessionId: string;

  @IsString()
  playerId: string;
}
