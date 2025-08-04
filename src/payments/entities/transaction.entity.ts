import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Customer } from './customer.entity';

export enum TransactionStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
  PARTIALLY_REFUNDED = 'partially_refunded',
}

export enum TransactionType {
  PAYMENT = 'payment',
  REFUND = 'refund',
  SUBSCRIPTION = 'subscription',
  CHARGEBACK = 'chargeback',
}

export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
}

@Entity('transactions')
@Index(['status'])
@Index(['type'])
@Index(['provider'])
@Index(['customerId'])
@Index(['providerTransactionId'])
@Index(['createdAt'])
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Customer, (customer) => customer.transactions, {
    onDelete: 'SET NULL',
  })
  @JoinColumn()
  customer: Customer;

  @Column('uuid', { nullable: true })
  customerId: string;

  @Column({
    type: 'enum',
    enum: TransactionStatus,
    default: TransactionStatus.PENDING,
  })
  status: TransactionStatus;

  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Column({
    type: 'enum',
    enum: PaymentProvider,
  })
  provider: PaymentProvider;

  @Column({ unique: true })
  providerTransactionId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: number;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  refundedAmount: number;

  @Column({ length: 3 })
  currency: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  providerData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Audit fields
  @Column({ type: 'jsonb', nullable: true })
  auditTrail: Array<{
    action: string;
    timestamp: Date;
    userId?: string;
    previousStatus?: TransactionStatus;
    newStatus?: TransactionStatus;
    notes?: string;
  }>;

  @Column({ nullable: true })
  failureReason: string;

  @Column({ nullable: true })
  failureCode: string;

  // Fraud detection
  @Column({ type: 'jsonb', nullable: true })
  fraudScore: {
    score: number;
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
  };

  @Column({ default: false })
  isFlagged: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;
}
