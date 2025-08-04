import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { ModerationAction } from '../enums';

@Entity('room_moderation_history')
@Index(['roomId'])
@Index(['moderatorId'])
@Index(['targetUserId'])
@Index(['action'])
@Index(['timestamp'])
export class RoomModerationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  roomId: string;

  @Column('uuid')
  moderatorId: string;

  @Column({ length: 100 })
  moderatorUsername: string;

  @Column('uuid')
  targetUserId: string;

  @Column({ length: 100 })
  targetUsername: string;

  @Column({
    type: 'enum',
    enum: ModerationAction,
  })
  action: ModerationAction;

  @Column({ length: 500, nullable: true })
  reason: string;

  @Column({ nullable: true })
  duration: number; // Duration in minutes for temporary actions

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ type: 'json', default: {} })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  ipAddress: string;

  @Column({ default: false })
  isReversed: boolean;

  @Column({ nullable: true })
  reversedBy: string;

  @Column({ nullable: true })
  reversedAt: Date;

  @Column({ nullable: true })
  reversalReason: string;

  @CreateDateColumn()
  timestamp: Date;

  // Helper methods
  isTemporary(): boolean {
    return !!this.duration && this.duration > 0;
  }

  isExpired(): boolean {
    return this.expiresAt && this.expiresAt <= new Date();
  }

  canBeReversed(): boolean {
    return (
      !this.isReversed &&
      [ModerationAction.BAN, ModerationAction.MUTE, ModerationAction.WARN].includes(this.action)
    );
  }
}
