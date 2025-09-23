import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('search_suggestions')
@Index(['query'])
@Index(['popularity'])
@Index(['lastUsed'])
export class SearchSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  query: string;

  @Column({ type: 'int', default: 0 })
  popularity: number;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastUsed?: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
