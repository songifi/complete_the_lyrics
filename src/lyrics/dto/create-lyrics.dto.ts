import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { LyricsCategory, LyricsDifficulty } from '../entities/lyrics.entity';

export class CreateLyricsDto {
  @IsString()
  @IsNotEmpty()
  snippet: string;

  @IsString()
  @IsNotEmpty()
  correctCompletion: string;

  @IsString()
  @IsNotEmpty()
  artist: string;

  @IsString()
  @IsNotEmpty()
  songTitle: string;

  @IsEnum(LyricsCategory)
  category: LyricsCategory;

  @IsEnum(LyricsDifficulty)
  difficulty: LyricsDifficulty;
}
