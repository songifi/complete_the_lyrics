import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { GameRoomEntity } from './game-room.entity';

export enum ActivityType {
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  USER_KICKED = 'user_kicked',
  USER_BANNED = 'user_banned',
  USER_MUTED = 'user_muted',
  USER_PROMOTED = 'user_promoted',
  USER_DEMOTED = 'user_demoted',
  ROOM_CREATED = 'room_created',
  ROOM_UPDATED = 'room_updated',
  ROOM_LOCKED = 'room_locked',
  ROOM_UNLOCKED = 'room_unlocked',
  MESSAGE_SENT = 'message_sent',
  GAME_STARTED = 'game_started',
  GAME_ENDED = 'game_ended',
  CUSTOM_EVENT = 'custom_event',
}

@Entity('room_activities')
@Index(['roomId'])
@Index(['activityType'])
@Index(['createdAt'])
@Index(['userId'])
export class RoomActivityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  roomId: string;

  @Column({
    type: 'enum',
    enum: ActivityType,
  })
  activityType: ActivityType;

  @Column('uuid', { nullable: true })
  userId: string;

  @Column({ length: 100, nullable: true })
  username: string;

  @Column({ length: 100, nullable: true })
  targetUserId: string;

  @Column({ length: 100, nullable: true })
  targetUsername: string;

  @Column({ length: 500, nullable: true })
  description: string;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ nullable: true })
  userAgent: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => GameRoomEntity, (room) => room.activities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'roomId' })
  room: GameRoomEntity;

  // Helper methods
  isUserActivity(): boolean {
    return [
      ActivityType.USER_JOINED,
      ActivityType.USER_LEFT,
      ActivityType.USER_KICKED,
      ActivityType.USER_BANNED,
      ActivityType.USER_MUTED,
      ActivityType.USER_PROMOTED,
      ActivityType.USER_DEMOTED,
    ].includes(this.activityType);
  }

  isRoomActivity(): boolean {
    return [
      ActivityType.ROOM_CREATED,
      ActivityType.ROOM_UPDATED,
      ActivityType.ROOM_LOCKED,
      ActivityType.ROOM_UNLOCKED,
    ].includes(this.activityType);
  }

  isGameActivity(): boolean {
    return [ActivityType.GAME_STARTED, ActivityType.GAME_ENDED].includes(this.activityType);
  }
}
