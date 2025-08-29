import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Achievement } from './achievement.entity';

@Entity('achievement_progress')
@Index(['userId', 'achievement'])
export class AchievementProgress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Achievement, (achievement) => achievement.progresses)
  @JoinColumn({ name: 'achievementId' })
  achievement: Achievement;

  @Column('int', { default: 0 })
  currentValue: number;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @UpdateDateColumn()
  lastUpdated: Date;
}