import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from 'typeorm';
import { Player } from './player.entity';

export enum AchievementType {
  COMBAT = 'combat',
  EXPLORATION = 'exploration',
  SOCIAL = 'social',
  MILESTONE = 'milestone',
  RARE = 'rare'
}

export enum AchievementRarity {
  COMMON = 'common',
  UNCOMMON = 'uncommon',
  RARE = 'rare',
  EPIC = 'epic',
  LEGENDARY = 'legendary'
}

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  playerId: string;

  @ManyToOne(() => Player, player => player.achievements)
  player: Player;

  @Column()
  achievementId: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({
    type: 'enum',
    enum: AchievementType
  })
  type: AchievementType;

  @Column({
    type: 'enum',
    enum: AchievementRarity
  })
  rarity: AchievementRarity;

  @Column('int', { default: 0 })
  points: number;

  @Column('jsonb', { nullable: true })
  criteria: {
    requiredValue?: number;
    requiredMetric?: string;
    timeframe?: string;
    [key: string]: any;
  };

  @Column({ default: false })
  isUnlocked: boolean;

  @Column({ type: 'timestamp', nullable: true })
  unlockedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}