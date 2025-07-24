import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum ChallengeStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
}

@Entity('daily_challenges')
@Index(['date'], { unique: true })
export class DailyChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'date' })
  date: string; // The day this challenge is for

  @Column({ type: 'jsonb' })
  objectives: any; // JSON schema for objectives (template-based)

  @Column({ type: 'jsonb', nullable: true })
  progress: any; // Progress tracking per user (can be moved to Redis for scale)

  @Column({ type: 'enum', enum: ChallengeStatus, default: ChallengeStatus.ACTIVE })
  status: ChallengeStatus;

  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @Column({ type: 'jsonb', nullable: true })
  rewards: any; // Rewards for completion

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 