import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
  Index,
} from 'typeorm';
import { IsString, IsOptional, IsUrl, IsDate, IsBoolean, IsNumber, Min, Max } from 'class-validator';
import { User } from '../../User/user.entity';
import { UserActivity } from './user-activity.entity';
import { UserFriend } from './user-friend.entity';
import { UserPreference } from './user-preference.entity';
import { UserStatistic } from './user-statistic.entity';

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  @Index()
  userId: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  bio?: string;

  @Column({ nullable: true })
  @IsUrl()
  @IsOptional()
  avatarUrl?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  avatarKey?: string; // For cloud storage reference

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  location?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  website?: string;

  @Column({ nullable: true })
  @IsDate()
  @IsOptional()
  dateOfBirth?: Date;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @Column({ default: 'en' })
  @IsString()
  language: string;

  @Column({ default: 'UTC' })
  @IsString()
  timezone: string;

  @Column({ default: 'public' })
  @IsString()
  profileVisibility: 'public' | 'private' | 'friends';

  @Column({ default: true })
  @IsBoolean()
  showOnlineStatus: boolean;

  @Column({ default: true })
  @IsBoolean()
  allowFriendRequests: boolean;

  @Column({ default: true })
  @IsBoolean()
  allowMessages: boolean;

  @Column({ default: true })
  @IsBoolean()
  showActivityStatus: boolean;

  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  totalGamesPlayed: number;

  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  totalGamesWon: number;

  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  totalPoints: number;

  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  @Max(100)
  winRate: number;

  @Column({ type: 'timestamptz', nullable: true })
  @IsDate()
  @IsOptional()
  lastActiveAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  achievements?: string[];

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  badges?: {
    id: string;
    name: string;
    description: string;
    earnedAt: Date;
  }[];

  @OneToMany(() => UserActivity, activity => activity.userProfile)
  activities: UserActivity[];

  @OneToMany(() => UserFriend, friend => friend.userProfile)
  friends: UserFriend[];

  @OneToMany(() => UserPreference, preference => preference.userProfile)
  preferences: UserPreference[];

  @OneToMany(() => UserStatistic, statistic => statistic.userProfile)
  statistics: UserStatistic[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  // Helper methods
  getWinRate(): number {
    if (this.totalGamesPlayed === 0) return 0;
    return Math.round((this.totalGamesWon / this.totalGamesPlayed) * 100);
  }

  updateWinRate(): void {
    this.winRate = this.getWinRate();
  }

  incrementGamesPlayed(): void {
    this.totalGamesPlayed += 1;
    this.updateWinRate();
  }

  incrementGamesWon(): void {
    this.totalGamesWon += 1;
    this.updateWinRate();
  }

  addPoints(points: number): void {
    this.totalPoints += points;
  }

  updateLastActive(): void {
    this.lastActiveAt = new Date();
  }
}
