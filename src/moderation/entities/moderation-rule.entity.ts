/* eslint-disable prettier/prettier */
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EscalationLevel } from 'src/common/enums/escalation-level.enum';
import { ContentType } from 'src/common/enums/content-type.enum';

@Entity('moderation_rules')
export class ModerationRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column({ type: 'enum', enum: ContentType })
  applicableContentType: ContentType;

  @Column('json')
  conditions: Record<string, any>;

  @Column('json')
  actions: Record<string, any>;

  @Column({ type: 'enum', enum: EscalationLevel })
  escalationLevel: EscalationLevel;

  @Column({ default: true })
  isActive: boolean;

  @Column('int', { default: 1 })
  priority: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
