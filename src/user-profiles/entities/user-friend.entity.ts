import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { IsString, IsEnum, IsOptional, IsDate } from 'class-validator';
import { UserProfile } from './user-profile.entity';

export enum FriendStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  BLOCKED = 'blocked',
}

@Entity('user_friends')
@Unique(['userProfileId', 'friendProfileId'])
@Index(['userProfileId', 'status'])
@Index(['friendProfileId', 'status'])
export class UserFriend {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => UserProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userProfileId' })
  userProfile: UserProfile;

  @Column()
  @Index()
  userProfileId: string;

  @ManyToOne(() => UserProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'friendProfileId' })
  friendProfile: UserProfile;

  @Column()
  @Index()
  friendProfileId: string;

  @Column({
    type: 'enum',
    enum: FriendStatus,
    default: FriendStatus.PENDING,
  })
  @IsEnum(FriendStatus)
  status: FriendStatus;

  @Column({ type: 'timestamptz', nullable: true })
  @IsDate()
  @IsOptional()
  acceptedAt?: Date;

  @Column({ type: 'timestamptz', nullable: true })
  @IsDate()
  @IsOptional()
  blockedAt?: Date;

  @Column({ type: 'text', nullable: true })
  @IsString()
  @IsOptional()
  blockReason?: string;

  @Column({ type: 'timestamptz', nullable: true })
  @IsDate()
  @IsOptional()
  lastInteractionAt?: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  // Helper methods
  accept(): void {
    this.status = FriendStatus.ACCEPTED;
    this.acceptedAt = new Date();
  }

  reject(): void {
    this.status = FriendStatus.REJECTED;
  }

  block(reason?: string): void {
    this.status = FriendStatus.BLOCKED;
    this.blockedAt = new Date();
    this.blockReason = reason;
  }

  unblock(): void {
    this.status = FriendStatus.ACCEPTED;
    this.blockedAt = null;
    this.blockReason = null;
  }

  updateLastInteraction(): void {
    this.lastInteractionAt = new Date();
  }

  isActive(): boolean {
    return this.status === FriendStatus.ACCEPTED;
  }

  isBlocked(): boolean {
    return this.status === FriendStatus.BLOCKED;
  }

  isPending(): boolean {
    return this.status === FriendStatus.PENDING;
  }
}
