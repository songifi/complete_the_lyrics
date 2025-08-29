import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { UserAchievement } from './user-achievement.entity';
import { AchievementProgress } from './achievement-progress.entity';

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column()
  category: string;

  @Column({
    type: 'enum',
    enum: ['cumulative', 'milestone', 'streak', 'completion'],
    default: 'cumulative',
  })
  type: 'cumulative' | 'milestone' | 'streak' | 'completion';

  @Column()
  triggerAction: string;

  @Column('int')
  targetValue: number;

  @Column('int', { default: 0 })
  points: number;

  @Column({
    type: 'enum',
    enum: ['bronze', 'silver', 'gold', 'platinum', 'diamond'],
    default: 'bronze',
  })
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @Column('json', { nullable: true })
  rewards: Array<{
    type: 'points' | 'badge' | 'item' | 'currency';
    value: number;
    metadata?: Record<string, any>;
  }>;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isHidden: boolean;

  @Column('int', { default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => UserAchievement, (userAchievement) => userAchievement.achievement)
  userAchievements: UserAchievement[];

  @OneToMany(() => AchievementProgress, (progress) => progress.achievement)
  progresses: AchievementProgress[];
}