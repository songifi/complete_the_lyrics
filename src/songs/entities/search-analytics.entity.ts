import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('search_analytics')
@Index(['userId'])
@Index(['createdAt'])
@Index(['query'])
export class SearchAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId?: string;

  @Column()
  query: string;

  @Column({ type: 'int', default: 0 })
  resultCount: number;

  @Column({ type: 'jsonb', nullable: true })
  filters?: Record<string, any>;

  @Column({ nullable: true })
  sortBy?: string;

  @Column({ type: 'int', default: 0 })
  responseTime: number; // milliseconds

  @Column({ type: 'boolean', default: false })
  clicked: boolean;

  @Column({ nullable: true })
  clickedSongId?: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
