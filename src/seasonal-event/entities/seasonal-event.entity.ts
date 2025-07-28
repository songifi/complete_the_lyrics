import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('seasonal_events')
@Index(['startTime', 'endTime'])
export class SeasonalEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz' })
  endTime: Date;

  @Column({ type: 'jsonb', nullable: true })
  gameModes?: any; // Event-specific game modes/challenges

  @Column({ type: 'jsonb', nullable: true })
  rewards?: any; // Event-specific rewards

  @Column({ type: 'jsonb', nullable: true })
  achievements?: any; // Event-specific achievements

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  featureFlags?: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
} 