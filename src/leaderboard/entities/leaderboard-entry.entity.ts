import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { Leaderboard } from './leaderboard.entity';

@Entity('leaderboard_entries')
@Index(['leaderboardId', 'rank'])
@Index(['userId', 'leaderboardId'], { unique: true })
export class LeaderboardEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  leaderboardId: string;

  @Column('uuid')
  userId: string;

  @Column('int')
  rank: number;

  @Column('int')
  score: number;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => Leaderboard, leaderboard => leaderboard.entries)
  @JoinColumn({ name: 'leaderboardId' })
  leaderboard: Leaderboard;

  @CreateDateColumn()
  createdAt: Date;
}