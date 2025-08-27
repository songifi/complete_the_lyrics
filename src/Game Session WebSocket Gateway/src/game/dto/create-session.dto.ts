import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Min,
  Max,
} from "class-validator";

export class CreateSessionDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(2)
  @Max(50)
  maxPlayers: number;

  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean = false;

  @IsOptional()
  @IsBoolean()
  allowSpectators?: boolean = true;

  @IsOptional()
  @IsNumber()
  @Min(10)
  @Max(1000)
  maxChatHistory?: number = 100;
}
