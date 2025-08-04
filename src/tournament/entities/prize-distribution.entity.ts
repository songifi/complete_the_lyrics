import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { PrizeType } from '../enums/tournament.enums';
import { Tournament } from './tournament.entity';

@Entity('prize_distributions')
@Unique(['tournamentId', 'rank'])
@Index(['tournamentId'])
@Index(['winnerId'])
export class PrizeDistribution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({ type: 'int' })
  rank: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  prizeAmount: number;

  @Column({
    type: 'enum',
    enum: PrizeType,
  })
  prizeType: PrizeType;

  @Column({ type: 'jsonb', nullable: true })
  prizeData?: Record<string, any>;

  @Column({ type: 'uuid', nullable: true })
  winnerId?: string;

  @Column({ type: 'timestamp', nullable: true })
  distributedAt?: Date;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Tournament, (tournament) => tournament.prizeDistributions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  // Computed properties
  get isDistributed(): boolean {
    return !!this.distributedAt && !!this.winnerId;
  }
}
