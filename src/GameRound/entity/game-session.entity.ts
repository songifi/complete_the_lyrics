import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { GameRound } from './game-round.entity';

export enum SessionStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('game_sessions')
@Index(['status'])
@Index(['createdAt'])
export class GameSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_code', unique: true })
  sessionCode: string;

  @Column({ name: 'host_id' })
  hostId: string;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.WAITING,
  })
  status: SessionStatus;

  @Column({ name: 'max_players', default: 8 })
  maxPlayers: number;

  @Column('jsonb', { default: [] })
  players: Array<{
    id: string;
    name: string;
    score: number;
    joinedAt: Date;
  }>;

  @Column('jsonb', { default: {} })
  settings: {
    roundTimeLimit?: number;
    maxRounds?: number;
    difficulty?: string;
    categories?: string[];
  };

  @Column({ name: 'started_at', type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => GameRound, round => round.session)
  rounds: GameRound[];
}
