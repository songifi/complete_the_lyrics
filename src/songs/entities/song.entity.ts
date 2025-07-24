import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum Genre {
  ROCK = 'rock',
  POP = 'pop',
  JAZZ = 'jazz',
  CLASSICAL = 'classical',
  ELECTRONIC = 'electronic',
  HIPHOP = 'hiphop',
  COUNTRY = 'country',
  BLUES = 'blues',
  REGGAE = 'reggae',
  FOLK = 'folk',
}

export enum DifficultyLevel {
  BEGINNER = 1,
  EASY = 2,
  INTERMEDIATE = 3,
  ADVANCED = 4,
  EXPERT = 5,
}

@Entity('songs')
@Index(['title', 'artist'])
@Index(['genre'])
@Index(['year'])
@Index(['difficulty'])
export class Song {
  @ApiProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ length: 255 })
  @Index({ fulltext: true })
  title: string;

  @ApiProperty()
  @Column({ length: 255 })
  @Index({ fulltext: true })
  artist: string;

  @ApiProperty()
  @Column({ length: 255, nullable: true })
  album?: string;

  @ApiProperty({ enum: Genre })
  @Column({ type: 'enum', enum: Genre })
  genre: Genre;

  @ApiProperty()
  @Column({ type: 'int', nullable: true })
  year?: number;

  @ApiProperty()
  @Column({ type: 'int', nullable: true })
  duration?: number; // in seconds

  @ApiProperty({ enum: DifficultyLevel })
  @Column({ type: 'enum', enum: DifficultyLevel, default: DifficultyLevel.INTERMEDIATE })
  difficulty: DifficultyLevel;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  difficultyScore: number;

  @ApiProperty()
  @Column({ type: 'text', nullable: true })
  lyrics?: string;

  @ApiProperty()
  @Column({ length: 500, nullable: true })
  filePath?: string;

  @ApiProperty()
  @Column({ length: 500, nullable: true })
  coverImagePath?: string;

  @ApiProperty()
  @Column({ type: 'simple-array', nullable: true })
  tags?: string[];

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  playCount: number;

  @ApiProperty()
  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  ratingCount: number;

  @ApiProperty()
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @ApiProperty()
  @UpdateDateColumn()
  updatedAt: Date;
}
