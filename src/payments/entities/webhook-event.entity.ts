import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookEventStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum WebhookProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

@Entity('webhook_events')
@Index(['provider'])
@Index(['eventType'])
@Index(['status'])
@Index(['providerEventId'])
@Index(['createdAt'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: WebhookProvider,
  })
  provider: WebhookProvider;

  @Column({ unique: true })
  providerEventId: string;

  @Column()
  eventType: string;

  @Column({
    type: 'enum',
    enum: WebhookEventStatus,
    default: WebhookEventStatus.PENDING,
  })
  status: WebhookEventStatus;

  @Column({ type: 'jsonb' })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  processedData: Record<string, any>;

  @Column({ nullable: true })
  errorMessage: string;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'int', default: 3 })
  maxRetries: number;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt: Date;

  // Signature verification
  @Column()
  signatureHeader: string;

  @Column({ default: true })
  signatureVerified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
