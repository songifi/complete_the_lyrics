import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('songs')
@Index(['artist'])
@Index(['genre'])
@Index(['releaseYear'])
export class Song {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column()
  artist: string;

  @Column({ nullable: true })
  album: string;

  @Column({ nullable: true })
  genre: string;

  @Column({ name: 'release_year', nullable: true })
  releaseYear: number;

  @Column({ name: 'duration_seconds', nullable: true })
  durationSeconds: number;

  @Column({ name: 'audio_url', nullable: true })
  audioUrl: string;

  @Column({ name: 'cover_image_url', nullable: true })
  coverImageUrl: string;

  @Column('text', { nullable: true })
  lyrics: string;

  @Column('jsonb', { default: {} })
  metadata: {
    bpm?: number;
    key?: string;
    popularity?: number;
    explicit?: boolean;
    previewUrl?: string;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
