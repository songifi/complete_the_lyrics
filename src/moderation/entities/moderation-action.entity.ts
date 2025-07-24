/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ModerationCase } from './moderation-case.entity';

@Entity('moderation_actions')
export class ModerationAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  action: string;

  @Column()
  performedBy: string;

  @Column('text', { nullable: true })
  reason: string;

  @Column('json', { nullable: true })
  metadata: Record<string, any>;

  @ManyToOne(() => ModerationCase, (moderationCase) => moderationCase.actions)
  @JoinColumn({ name: 'moderation_case_id' })
  moderationCase: ModerationCase;

  @CreateDateColumn()
  createdAt: Date;
}
