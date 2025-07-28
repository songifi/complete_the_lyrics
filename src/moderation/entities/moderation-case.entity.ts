/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { ContentType } from '../../common/enums/content-type.enum';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';
import { ModerationAction } from './moderation-action.entity';

@Entity('moderation_cases')
export class ModerationCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  contentId: string;

  @Column({ type: 'enum', enum: ContentType })
  contentType: ContentType;

  @Column('text')
  content: string;

  @Column({
    type: 'enum',
    enum: ModerationStatus,
    default: ModerationStatus.PENDING,
  })
  status: ModerationStatus;

  @Column({ type: 'enum', enum: EscalationLevel, default: EscalationLevel.LOW })
  escalationLevel: EscalationLevel;

  @Column('decimal', { precision: 3, scale: 2, default: 0 })
  confidenceScore: number;

  @Column('json', { nullable: true })
  violationDetails: Record<string, any>;

  @Column('simple-array', { nullable: true })
  appliedRuleIds: string[];

  @Column({ nullable: true })
  assignedModerator: string;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @OneToMany(() => ModerationAction, (action) => action.moderationCase)
  actions: ModerationAction[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
