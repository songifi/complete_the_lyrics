import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';

export enum RoundStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  FINISHED = 'finished',
  PAUSED = 'paused'
}

@Entity('rounds')
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  gameId: string;

  @Column()
  roundNumber: number;

  @Column({ type: 'enum', enum: RoundStatus, default: RoundStatus.WAITING })
  status: RoundStatus;

  @Column({ type: 'jsonb', nullable: true })
  questions: any[];

  @Column({ type: 'int', default: 0 })
  currentQuestionIndex: number;

  @Column({ type: 'int', default: 30 })
  timePerQuestion: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
