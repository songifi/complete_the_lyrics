import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { IsString, IsNumber, IsOptional, IsDate, Min } from 'class-validator';
import { UserProfile } from './user-profile.entity';

export enum StatisticType {
  DAILY_GAMES_PLAYED = 'daily_games_played',
  DAILY_GAMES_WON = 'daily_games_won',
  DAILY_POINTS_EARNED = 'daily_points_earned',
  WEEKLY_GAMES_PLAYED = 'weekly_games_played',
  WEEKLY_GAMES_WON = 'weekly_games_won',
  WEEKLY_POINTS_EARNED = 'weekly_points_earned',
  MONTHLY_GAMES_PLAYED = 'monthly_games_played',
  MONTHLY_GAMES_WON = 'monthly_games_won',
  MONTHLY_POINTS_EARNED = 'monthly_points_earned',
  TOTAL_PLAYTIME_MINUTES = 'total_playtime_minutes',
  AVERAGE_GAME_DURATION = 'average_game_duration',
  LONGEST_WIN_STREAK = 'longest_win_streak',
  CURRENT_WIN_STREAK = 'current_win_streak',
  FASTEST_GAME_COMPLETION = 'fastest_game_completion',
  PERFECT_GAMES = 'perfect_games',
  FRIENDS_ADDED = 'friends_added',
  ACHIEVEMENTS_EARNED = 'achievements_earned',
  BADGES_EARNED = 'badges_earned',
}

@Entity('user_statistics')
@Unique(['userProfileId', 'type', 'period'])
@Index(['userProfileId', 'type'])
@Index(['type', 'period'])
export class UserStatistic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userProfileId' })
  userProfile: UserProfile;

  @Column()
  @Index()
  userProfileId: string;

  @Column({
    type: 'enum',
    enum: StatisticType,
  })
  @IsString()
  type: StatisticType;

  @Column({ default: 'all' })
  @IsString()
  period: string; // 'all', '2024-01', '2024-W01', '2024-01-15'

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0 })
  @IsNumber()
  @Min(0)
  value: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  @IsNumber()
  @IsOptional()
  previousValue?: number;

  @Column({ type: 'timestamptz', nullable: true })
  @IsDate()
  @IsOptional()
  lastUpdated?: Date;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Helper methods
  increment(amount: number = 1): void {
    this.previousValue = this.value;
    this.value += amount;
    this.lastUpdated = new Date();
  }

  setValue(newValue: number): void {
    this.previousValue = this.value;
    this.value = newValue;
    this.lastUpdated = new Date();
  }

  getChange(): number {
    if (this.previousValue === null || this.previousValue === undefined) {
      return 0;
    }
    return this.value - this.previousValue;
  }

  getPercentageChange(): number {
    if (this.previousValue === null || this.previousValue === undefined || this.previousValue === 0) {
      return 0;
    }
    return ((this.value - this.previousValue) / this.previousValue) * 100;
  }

  static createPeriodKey(type: StatisticType, date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const week = Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7);

    switch (type) {
      case StatisticType.DAILY_GAMES_PLAYED:
      case StatisticType.DAILY_GAMES_WON:
      case StatisticType.DAILY_POINTS_EARNED:
        return `${year}-${month}-${day}`;
      case StatisticType.WEEKLY_GAMES_PLAYED:
      case StatisticType.WEEKLY_GAMES_WON:
      case StatisticType.WEEKLY_POINTS_EARNED:
        return `${year}-W${String(week).padStart(2, '0')}`;
      case StatisticType.MONTHLY_GAMES_PLAYED:
      case StatisticType.MONTHLY_GAMES_WON:
      case StatisticType.MONTHLY_POINTS_EARNED:
        return `${year}-${month}`;
      default:
        return 'all';
    }
  }
}
