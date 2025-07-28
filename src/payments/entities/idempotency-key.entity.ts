import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('idempotency_keys')
@Index(['key'], { unique: true })
@Index(['userId'])
@Index(['createdAt'])
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  key: string;

  @Column('uuid', { nullable: true })
  userId: string;

  @Column()
  operation: string;

  @Column({ type: 'jsonb' })
  requestData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  responseData: Record<string, any>;

  @Column({ default: 'pending' })
  status: string;

  @Column({
    type: 'timestamp',
    default: () => "CURRENT_TIMESTAMP + INTERVAL '24 hours'",
  })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
