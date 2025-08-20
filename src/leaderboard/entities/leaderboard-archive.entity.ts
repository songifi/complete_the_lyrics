import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('leaderboard_archives')
@Index(['originalLeaderboardId', 'archivedAt'])
export class LeaderboardArchive {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  originalLeaderboardId: string;

  @Column('jsonb')
  leaderboardData: Record<string, any>;

  @Column('jsonb')
  entriesData: Record<string, any>[];

  @CreateDateColumn()
  archivedAt: Date;
}