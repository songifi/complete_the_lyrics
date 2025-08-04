import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TournamentEventType } from '../enums/tournament.enums';
import { Tournament } from './tournament.entity';

@Entity('tournament_events')
@Index(['tournamentId', 'eventType'])
@Index(['tournamentId', 'createdAt'])
export class TournamentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({
    type: 'enum',
    enum: TournamentEventType,
  })
  eventType: TournamentEventType;

  @Column({ type: 'jsonb' })
  eventData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Tournament, (tournament) => tournament.tournamentEvents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;
}
