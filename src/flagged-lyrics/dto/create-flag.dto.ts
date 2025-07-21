import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateFlagDto {
  @IsNumber()
  @IsNotEmpty()
  lyricsId: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
