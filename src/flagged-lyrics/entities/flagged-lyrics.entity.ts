import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Lyrics } from '../../lyrics/entities/lyrics.entity';

export enum FlagStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Entity('flagged_lyrics')
export class FlaggedLyrics {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  lyricsId: number;

  @ManyToOne(() => Lyrics)
  @JoinColumn({ name: 'lyricsId' })
  lyrics: Lyrics;

  @Column()
  flaggedByUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'flaggedByUserId' })
  flaggedBy: User;

  @Column('text')
  reason: string;

  @Column({
    type: 'enum',
    enum: FlagStatus,
    default: FlagStatus.PENDING,
  })
  status: FlagStatus;

  @Column({ nullable: true })
  resolvedByUserId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'resolvedByUserId' })
  resolvedBy?: User;

  @Column('text', { nullable: true })
  resolutionNotes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
