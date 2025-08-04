import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { RoomAccessType } from '../enums';
import { RoomConfiguration } from '../interfaces';

@Entity('room_templates')
@Index(['name'])
@Index(['category'])
@Index(['isPublic'])
@Index(['createdBy'])
export class RoomTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  @Index()
  name: string;

  @Column({ length: 500 })
  description: string;

  @Column({ length: 50 })
  category: string;

  @Column({ default: true })
  isPublic: boolean;

  @Column({
    type: 'enum',
    enum: RoomAccessType,
    default: RoomAccessType.PUBLIC,
  })
  accessType: RoomAccessType;

  @Column({ type: 'json' })
  configuration: RoomConfiguration;

  @Column({ type: 'simple-array', default: [] })
  defaultRoles: string[];

  @Column({ type: 'simple-array', default: [] })
  tags: string[];

  @Column('uuid')
  createdBy: string;

  @Column({ length: 100 })
  createdByUsername: string;

  @Column({ default: 0 })
  usageCount: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', default: {} })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
