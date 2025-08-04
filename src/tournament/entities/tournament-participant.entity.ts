import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { ParticipantStatus } from '../enums/tournament.enums';
import { Tournament } from './tournament.entity';
import { Match } from './match.entity';
import { MatchResult } from './match-result.entity';

@Entity('tournament_participants')
@Unique(['tournamentId', 'playerId'])
@Index(['tournamentId', 'status'])
@Index(['seed'])
export class TournamentParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({ type: 'uuid' })
  playerId: string;

  @Column({ type: 'uuid', nullable: true })
  teamId?: string;

  @Column({
    type: 'enum',
    enum: ParticipantStatus,
    default: ParticipantStatus.REGISTERED,
  })
  status: ParticipantStatus;

  @Column({ type: 'int', nullable: true })
  seed?: number;

  @CreateDateColumn()
  registeredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  eliminatedAt?: Date;

  @Column({ type: 'int', nullable: true })
  eliminatedInRound?: number;

  @Column({ type: 'int', nullable: true })
  currentRank?: number;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'int', default: 0 })
  wins: number;

  @Column({ type: 'int', default: 0 })
  losses: number;

  @Column({ type: 'int', default: 0 })
  draws: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Tournament, (tournament) => tournament.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @OneToMany(() => Match, (match) => match.homeParticipant)
  homeMatches: Match[];

  @OneToMany(() => Match, (match) => match.awayParticipant)
  awayMatches: Match[];

  @OneToMany(() => MatchResult, (result) => result.participant)
  matchResults: MatchResult[];

  // Computed properties
  get totalMatches(): number {
    return this.wins + this.losses + this.draws;
  }

  get winRate(): number {
    const total = this.totalMatches;
    return total > 0 ? this.wins / total : 0;
  }

  get isActive(): boolean {
    return (
      this.status === ParticipantStatus.ACTIVE ||
      this.status === ParticipantStatus.CONFIRMED
    );
  }

  get isEliminated(): boolean {
    return this.status === ParticipantStatus.ELIMINATED;
  }
}
