import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { RoomAccessType, RoomStatus } from '../enums';
import { RoomConfiguration, RoomAnalytics } from '../interfaces';
import { RoomMemberEntity } from './room-member.entity';
import { RoomActivityEntity } from './room-activity.entity';

@Entity('game_rooms')
@Index(['ownerId'])
@Index(['accessType'])
@Index(['status'])
@Index(['createdAt'])
export class GameRoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @Index()
  name: string;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ length: 100, nullable: true })
  @Index()
  tag: string;

  @Column({
    type: 'enum',
    enum: RoomAccessType,
    default: RoomAccessType.PUBLIC,
  })
  accessType: RoomAccessType;

  @Column({
    type: 'enum',
    enum: RoomStatus,
    default: RoomStatus.ACTIVE,
  })
  status: RoomStatus;

  @Column({ nullable: true })
  passwordHash: string;

  @Column({ default: '' })
  passwordSalt: string;

  @Column('uuid')
  ownerId: string;

  @Column({ length: 100 })
  ownerUsername: string;

  @Column({ default: 0 })
  currentCapacity: number;

  @Column({ type: 'json' })
  configuration: RoomConfiguration;

  @Column({ type: 'json', nullable: true })
  analytics: RoomAnalytics;

  @Column({ type: 'json', default: {} })
  metadata: Record<string, any>;

  @Column({ type: 'simple-array', default: [] })
  bannedUsers: string[];

  @Column({ type: 'simple-array', default: [] })
  moderators: string[];

  @Column({ type: 'simple-array', default: [] })
  invitedUsers: string[];

  @Column({ nullable: true })
  templateId: string;

  @Column({ default: false })
  isLocked: boolean;

  @Column({ default: false })
  isArchived: boolean;

  @Column({ nullable: true })
  archivedAt: Date;

  @Column({ nullable: true })
  lastActivityAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => RoomMemberEntity, (member) => member.room, {
    cascade: true,
    eager: false,
  })
  members: RoomMemberEntity[];

  @OneToMany(() => RoomActivityEntity, (activity) => activity.room, {
    cascade: true,
    eager: false,
  })
  activities: RoomActivityEntity[];

  // Helper methods
  isFull(): boolean {
    return this.currentCapacity >= this.configuration.maxCapacity;
  }

  canJoin(userId: string): boolean {
    return (
      !this.isFull() &&
      !this.bannedUsers.includes(userId) &&
      this.status === RoomStatus.ACTIVE &&
      !this.isLocked
    );
  }

  isOwner(userId: string): boolean {
    return this.ownerId === userId;
  }

  isModerator(userId: string): boolean {
    return this.moderators.includes(userId) || this.isOwner(userId);
  }

  hasPassword(): boolean {
    return this.accessType === RoomAccessType.PASSWORD_PROTECTED && !!this.passwordHash;
  }

  isPublic(): boolean {
    return this.accessType === RoomAccessType.PUBLIC;
  }

  isPrivate(): boolean {
    return this.accessType === RoomAccessType.PRIVATE;
  }

  canAccess(userId: string): boolean {
    if (this.isPublic()) return true;
    if (this.isPrivate()) return this.invitedUsers.includes(userId) || this.isOwner(userId);
    return true; // Password-protected rooms are handled separately
  }
}
