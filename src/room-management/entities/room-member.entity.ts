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
import { RoomRole } from '../enums';
import { GameRoomEntity } from './game-room.entity';

@Entity('room_members')
@Unique(['roomId', 'userId'])
@Index(['roomId'])
@Index(['userId'])
@Index(['role'])
export class RoomMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  roomId: string;

  @Column('uuid')
  userId: string;

  @Column({ length: 100 })
  username: string;

  @Column({
    type: 'enum',
    enum: RoomRole,
    default: RoomRole.MEMBER,
  })
  role: RoomRole;

  @Column({ default: false })
  isMuted: boolean;

  @Column({ default: false })
  isBanned: boolean;

  @Column({ nullable: true })
  muteExpiresAt: Date;

  @Column({ nullable: true })
  banExpiresAt: Date;

  @Column({ nullable: true })
  muteReason: string;

  @Column({ nullable: true })
  banReason: string;

  @Column({ nullable: true })
  mutedBy: string;

  @Column({ nullable: true })
  bannedBy: string;

  @Column({ type: 'simple-array', default: [] })
  permissions: string[];

  @Column({ type: 'json', default: {} })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  lastActivityAt: Date;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  joinedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => GameRoomEntity, (room) => room.members, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roomId' })
  room: GameRoomEntity;

  // Helper methods
  isOwner(): boolean {
    return this.role === RoomRole.OWNER;
  }

  isModerator(): boolean {
    return this.role === RoomRole.MODERATOR || this.isOwner();
  }

  canModerate(): boolean {
    return this.isModerator() && !this.isMuted && !this.isBanned;
  }

  hasPermission(permission: string): boolean {
    return this.permissions.includes(permission) || this.isOwner();
  }

  isTemporarilyMuted(): boolean {
    return this.isMuted && this.muteExpiresAt && this.muteExpiresAt > new Date();
  }

  isTemporarilyBanned(): boolean {
    return this.isBanned && this.banExpiresAt && this.banExpiresAt > new Date();
  }

  shouldUnmute(): boolean {
    return this.isMuted && this.muteExpiresAt && this.muteExpiresAt <= new Date();
  }

  shouldUnban(): boolean {
    return this.isBanned && this.banExpiresAt && this.banExpiresAt <= new Date();
  }
}
