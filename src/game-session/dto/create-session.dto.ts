import { IsInt, IsArray, IsOptional, IsString, Min, Max } from 'class-validator';

export class CreateSessionDto {
  @IsInt()
  @Min(2)
  @Max(10)
  maxPlayers: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  playerIds?: string[];
}
