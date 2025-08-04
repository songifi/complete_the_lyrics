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
import { BracketPosition } from '../enums/tournament.enums';
import { Tournament } from './tournament.entity';
import { Match } from './match.entity';

@Entity('brackets')
@Unique(['tournamentId', 'position', 'round', 'matchNumber'])
@Index(['tournamentId', 'position'])
export class Bracket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tournamentId: string;

  @Column({
    type: 'enum',
    enum: BracketPosition,
  })
  position: BracketPosition;

  @Column({ type: 'int' })
  round: number;

  @Column({ type: 'int' })
  matchNumber: number;

  @Column({ type: 'uuid', nullable: true })
  nextMatchId?: string;

  @Column({ type: 'uuid', nullable: true })
  previousMatch1Id?: string;

  @Column({ type: 'uuid', nullable: true })
  previousMatch2Id?: string;

  @Column({ type: 'jsonb' })
  structure: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => Tournament, (tournament) => tournament.brackets, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tournamentId' })
  tournament: Tournament;

  @OneToMany(() => Match, (match) => match.bracket)
  matches: Match[];
}
