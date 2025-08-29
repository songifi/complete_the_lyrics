import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Achievement } from './achievement.entity';

@Entity('user_achievements')
@Index(['userId', 'achievement'])
export class UserAchievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Achievement, (achievement) => achievement.userAchievements)
  @JoinColumn({ name: 'achievementId' })
  achievement: Achievement;

  @Column({
    type: 'enum',
    enum: ['locked', 'in_progress', 'unlocked'],
    default: 'locked',
  })
  status: 'locked' | 'in_progress' | 'unlocked';

  @Column('int', { default: 0 })
  progress: number;

  @Column({ nullable: true })
  unlockedAt: Date;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}