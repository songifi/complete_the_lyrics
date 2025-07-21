import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Team } from './team.entity';

export enum ScorePeriod {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  ALL_TIME = 'all_time',
}

@Entity('team_scores')
export class TeamScore {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  teamId: number;

  @ManyToOne(() => Team, (team) => team.teamScores)
  @JoinColumn({ name: 'teamId' })
  team: Team;

  @Column({
    type: 'enum',
    enum: ScorePeriod,
  })
  period: ScorePeriod;

  @Column({ default: 0 })
  score: number;

  @Column({ default: 0 })
  totalAttempts: number;

  @Column({ default: 0 })
  correctAttempts: number;

  @Column('decimal', { precision: 5, scale: 2, default: 0 })
  averageAccuracy: number;

  @Column({ type: 'date' })
  periodStart: Date;

  @Column({ type: 'date' })
  periodEnd: Date;

  @CreateDateColumn()
  createdAt: Date;
}
