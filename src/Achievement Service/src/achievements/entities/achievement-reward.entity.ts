import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('achievement_rewards')
@Index(['userId', 'claimed'])
export class AchievementReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  achievementId: string;

  @Column({
    type: 'enum',
    enum: ['points', 'badge', 'item', 'currency'],
  })
  type: 'points' | 'badge' | 'item' | 'currency';

  @Column('int')
  value: number;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @Column({ default: false })
  claimed: boolean;

  @CreateDateColumn()
  earnedAt: Date;

  @Column({ nullable: true })
  claimedAt: Date;
}