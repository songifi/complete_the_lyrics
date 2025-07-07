import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export enum LyricsCategory {
  POP = 'pop',
  ROCK = 'rock',
  HIPHOP = 'hiphop',
  COUNTRY = 'country',
  RNB = 'rnb',
  OTHER = 'other',
}

export enum LyricsDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
}

@Entity('lyrics')
export class Lyrics {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  @IsString()
  @IsNotEmpty()
  snippet: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  correctCompletion: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  artist: string;

  @Column()
  @IsString()
  @IsNotEmpty()
  songTitle: string;

  @Column({ type: 'enum', enum: LyricsCategory })
  @IsEnum(LyricsCategory)
  category: LyricsCategory;

  @Column({ type: 'enum', enum: LyricsDifficulty })
  @IsEnum(LyricsDifficulty)
  difficulty: LyricsDifficulty;

  @CreateDateColumn()
  createdAt: Date;
}
