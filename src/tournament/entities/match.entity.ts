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
import { MatchStatus } from '../enums/tournament.enums';
import { Tournament } from './tournament.entity';
import { TournamentParticipant } from './tournament-participant.entity';
import { Bracket } from './bracket.entity';
import { MatchResult } from './match-result.entity';

@Entity('matches')
@Unique(['tournamentId', 'round', 'matchNumber'])
@Index(['tournamentId', 'round'])
@Index(['status', 'scheduledAt'])
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({ type: 'uuid', nullable: true })
  bracketId?: string;

  @Column({ type: 'int' })
  round: number;

  @Column({ type: 'int' })
  matchNumber: number;

  @Column({ type: 'uuid', nullable: true })
  homeParticipantId?: string;

  @Column({ type: 'uuid', nullable: true })
  awayParticipantId?: string;

  @Column({
    type: 'enum',
    enum: MatchStatus,
    default: MatchStatus.SCHEDULED,
  })
  status: MatchStatus;

  @Column({ type: 'timestamp', nullable: true })
  scheduledAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date;

  @Column({ type: 'int', nullable: true })
  homeScore?: number;

  @Column({ type: 'int', nullable: true })
  awayScore?: number;

  @Column({ type: 'uuid', nullable: true })
  winnerId?: string;

  @Column({ type: 'boolean', default: false })
  isDraw: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Tournament, (tournament) => tournament.matches, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @ManyToOne(() => Bracket, (bracket) => bracket.matches, {
    nullable: true,
  })
  @JoinColumn({ name: 'bracketId' })
  bracket?: Bracket;

  @ManyToOne(
    () => TournamentParticipant,
    (participant) => participant.homeMatches,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'homeParticipantId' })
  homeParticipant?: TournamentParticipant;

  @ManyToOne(
    () => TournamentParticipant,
    (participant) => participant.awayMatches,
    {
      nullable: true,
    },
  )
  @JoinColumn({ name: 'awayParticipantId' })
  awayParticipant?: TournamentParticipant;

  @OneToMany(() => MatchResult, (result) => result.match)
  results: MatchResult[];

  // Computed properties
  get isCompleted(): boolean {
    return this.status === MatchStatus.COMPLETED;
  }

  get hasWinner(): boolean {
    return !this.isDraw && !!this.winnerId;
  }

  get duration(): number | null {
    if (this.startedAt && this.completedAt) {
      return this.completedAt.getTime() - this.startedAt.getTime();
    }
    return null;
  }

  get participants(): (TournamentParticipant | undefined)[] {
    return [this.homeParticipant, this.awayParticipant];
  }
}
