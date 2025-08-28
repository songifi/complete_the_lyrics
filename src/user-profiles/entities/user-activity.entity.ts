import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { IsString, IsOptional, IsEnum } from 'class-validator';
import { UserProfile } from './user-profile.entity';

export enum ActivityType {
  LOGIN = 'login',
  LOGOUT = 'logout',
  GAME_STARTED = 'game_started',
  GAME_COMPLETED = 'game_completed',
  GAME_WON = 'game_won',
  GAME_LOST = 'game_lost',
  PROFILE_UPDATED = 'profile_updated',
  AVATAR_UPLOADED = 'avatar_uploaded',
  FRIEND_ADDED = 'friend_added',
  FRIEND_REMOVED = 'friend_removed',
  ACHIEVEMENT_EARNED = 'achievement_earned',
  BADGE_EARNED = 'badge_earned',
  PREFERENCE_CHANGED = 'preference_changed',
  PRIVACY_SETTING_CHANGED = 'privacy_setting_changed',
}

@Entity('user_activities')
@Index(['userProfileId', 'createdAt'])
@Index(['activityType', 'createdAt'])
export class UserActivity {
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
    enum: ActivityType,
  })
  @IsEnum(ActivityType)
  activityType: ActivityType;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  @IsOptional()
  metadata?: Record<string, any>;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  ipAddress?: string;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  userAgent?: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // Helper method to create activity description
  static createDescription(type: ActivityType, metadata?: Record<string, any>): string {
    switch (type) {
      case ActivityType.LOGIN:
        return 'User logged in';
      case ActivityType.LOGOUT:
        return 'User logged out';
      case ActivityType.GAME_STARTED:
        return `Started a new game${metadata?.gameType ? ` (${metadata.gameType})` : ''}`;
      case ActivityType.GAME_COMPLETED:
        return `Completed a game${metadata?.score ? ` with score ${metadata.score}` : ''}`;
      case ActivityType.GAME_WON:
        return `Won a game${metadata?.score ? ` with score ${metadata.score}` : ''}`;
      case ActivityType.GAME_LOST:
        return `Lost a game${metadata?.score ? ` with score ${metadata.score}` : ''}`;
      case ActivityType.PROFILE_UPDATED:
        return 'Updated profile information';
      case ActivityType.AVATAR_UPLOADED:
        return 'Uploaded new avatar';
      case ActivityType.FRIEND_ADDED:
        return `Added ${metadata?.friendUsername || 'a friend'}`;
      case ActivityType.FRIEND_REMOVED:
        return `Removed ${metadata?.friendUsername || 'a friend'}`;
      case ActivityType.ACHIEVEMENT_EARNED:
        return `Earned achievement: ${metadata?.achievementName || 'Unknown'}`;
      case ActivityType.BADGE_EARNED:
        return `Earned badge: ${metadata?.badgeName || 'Unknown'}`;
      case ActivityType.PREFERENCE_CHANGED:
        return `Changed ${metadata?.preferenceKey || 'preference'}`;
      case ActivityType.PRIVACY_SETTING_CHANGED:
        return `Changed privacy setting: ${metadata?.settingKey || 'Unknown'}`;
      default:
        return 'Activity performed';
    }
  }
}
