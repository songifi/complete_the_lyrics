import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { TournamentFormat, TournamentStatus } from '../enums/tournament.enums';
import { TournamentParticipant } from './tournament-participant.entity';
import { Match } from './match.entity';
import { Bracket } from './bracket.entity';
import { PrizeDistribution } from './prize-distribution.entity';
import { TournamentEvent } from './tournament-event.entity';

@Entity('tournaments')
@Index(['status', 'startAt'])
@Index(['format', 'status'])
@Index(['createdBy'])
export class Tournament {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    type: 'enum',
    enum: TournamentFormat,
  })
  format: TournamentFormat;

  @Column({
    type: 'enum',
    enum: TournamentStatus,
    default: TournamentStatus.DRAFT,
  })
  status: TournamentStatus;

  @Column({ type: 'int', nullable: true })
  maxParticipants?: number;

  @Column({ type: 'int', default: 2 })
  minParticipants: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  entryFee?: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  prizePool?: number;

  @Column({ type: 'timestamp' })
  registrationStartAt: Date;

  @Column({ type: 'timestamp' })
  registrationEndAt: Date;

  @Column({ type: 'timestamp' })
  startAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  rules?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'boolean', default: true })
  isPublic: boolean;

  @Column({ type: 'boolean', default: false })
  allowLateRegistration: boolean;

  @Column({ type: 'boolean', default: false })
  requireApproval: boolean;

  @Column({ type: 'jsonb', nullable: true })
  seeding?: Record<string, any>;

  @Column({ type: 'uuid' })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(
    () => TournamentParticipant,
    (participant) => participant.tournament,
  )
  participants: TournamentParticipant[];

  @OneToMany(() => Match, (match) => match.tournament)
  matches: Match[];

  @OneToMany(() => Bracket, (bracket) => bracket.tournament)
  brackets: Bracket[];

  @OneToMany(() => PrizeDistribution, (prize) => prize.tournament)
  prizeDistributions: PrizeDistribution[];

  @OneToMany(() => TournamentEvent, (event) => event.tournament)
  tournamentEvents: TournamentEvent[];

  // Computed properties
  get isRegistrationOpen(): boolean {
    const now = new Date();
    return (
      this.status === TournamentStatus.REGISTRATION_OPEN &&
      now >= this.registrationStartAt &&
      now <= this.registrationEndAt
    );
  }

  get canRegister(): boolean {
    return (
      this.isRegistrationOpen ||
      (this.allowLateRegistration &&
        this.status === TournamentStatus.REGISTRATION_CLOSED)
    );
  }

  get participantCount(): number {
    return this.participants?.length || 0;
  }

  get isFull(): boolean {
    return this.maxParticipants
      ? this.participantCount >= this.maxParticipants
      : false;
  }
}
