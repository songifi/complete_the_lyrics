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
import { Match } from './match.entity';
import { TournamentParticipant } from './tournament-participant.entity';

@Entity('match_results')
@Unique(['matchId', 'participantId'])
@Index(['matchId'])
@Index(['participantId'])
export class MatchResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  matchId: string;

  @Column({ type: 'uuid' })
  participantId: string;

  @Column({ type: 'int' })
  score: number;

  @Column({ type: 'jsonb', nullable: true })
  performance?: Record<string, any>;

  @CreateDateColumn()
  recordedAt: Date;

  // Relations
  @ManyToOne(() => Match, (match) => match.results, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'matchId' })
  match: Match;

  @ManyToOne(
    () => TournamentParticipant,
    (participant) => participant.matchResults,
  )
  @JoinColumn({ name: 'participantId' })
  participant: TournamentParticipant;
}
