import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('achievement_analytics')
@Index(['userId', 'timestamp'])
@Index(['achievementId', 'eventType'])
export class AchievementAnalytics {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  achievementId: string;

  @Column({
    type: 'enum',
    enum: ['unlock', 'progress', 'share', 'view'],
  })
  eventType: 'unlock' | 'progress' | 'share' | 'view';

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  timestamp: Date;
}