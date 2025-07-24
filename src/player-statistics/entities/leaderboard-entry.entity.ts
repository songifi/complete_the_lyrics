import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('leaderboard_entries')
@Index(['category', 'timeframe', 'rank'])
@Index(['playerId', 'category', 'timeframe'])
export class LeaderboardEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  playerId: string;

  @Column()
  username: string;

  @Column()
  category: string;

  @Column()
  timeframe: string; // 'daily', 'weekly', 'monthly', 'all-time'

  @Column('int')
  rank: number;

  @Column('decimal', { precision: 15, scale: 2 })
  score: number;

  @Column('jsonb', { nullable: true })
  additionalData: {
    level?: number;
    achievements?: number;
    winRate?: number;
    [key: string]: any;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}