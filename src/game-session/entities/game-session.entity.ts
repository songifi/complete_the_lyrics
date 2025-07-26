import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, JoinTable, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum GameSessionStatus {
  WAITING = 'waiting',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
}

@Entity()
export class GameSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: GameSessionStatus, default: GameSessionStatus.WAITING })
  status: GameSessionStatus;

  @Column('simple-array')
  playerIds: string[];

  @Column({ type: 'int', default: 0 })
  maxPlayers: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt?: Date;

  @Column({ type: 'int', default: 0 })
  duration: number;

  @Column({ type: 'float', default: 0 })
  completionRate: number;

  @Column({ type: 'jsonb', nullable: true })
  playerActions?: any;
}
