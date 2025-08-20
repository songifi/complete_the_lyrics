import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { LeaderboardEntry } from './leaderboard-entry.entity';

export enum LeaderboardType {
  GLOBAL = 'global',
  FRIENDS = 'friends', 
  SEASONAL = 'seasonal'
}

export enum LeaderboardPeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time'
}

@Entity('leaderboards')
@Index(['type', 'period', 'isActive'])
export class Leaderboard {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: LeaderboardType })
  type: LeaderboardType;

  @Column({ type: 'enum', enum: LeaderboardPeriod })
  period: LeaderboardPeriod;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'timestamp', nullable: true })
  startDate: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate: Date;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => LeaderboardEntry, entry => entry.leaderboard)
  entries: LeaderboardEntry[];

  @CreateDateColumn()
  createdAt: Date;
}