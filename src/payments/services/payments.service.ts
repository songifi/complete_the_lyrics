import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository, DataSource } from 'typeorm';
import { Queue } from 'bull';

import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentProvider,
} from '../entities/transaction.entity';
import { Customer } from '../entities/customer.entity';
import { StripeService } from './stripe.service';
import { CustomerService } from './customer.service';
import { TransactionService } from './transaction.service';
import { FraudDetectionService } from './fraud-detection.service';
import { AuditService } from './audit.service';
import { IdempotencyService } from './idempotency.service';

import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import {
  ProcessPaymentDto,
  RefundPaymentDto,
} from '../dto/process-payment.dto';

export interface PaymentResult {
  transactionId: string;
  status: TransactionStatus;
  clientSecret?: string;
  requiresAction?: boolean;
  nextAction?: any;
  errorMessage?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectQueue('payment-processing')
    private readonly paymentQueue: Queue,
    private readonly dataSource: DataSource,
    private readonly stripeService: StripeService,
    private readonly customerService: CustomerService,
    private readonly transactionService: TransactionService,
    private readonly fraudDetectionService: FraudDetectionService,
    private readonly auditService: AuditService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
    idempotencyKey?: string,
  ): Promise<PaymentResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check idempotency if key provided
      if (idempotencyKey) {
        const existingResult = await this.idempotencyService.checkIdempotency(
          idempotencyKey,
          dto.userId,
          'create_payment_intent',
          dto,
        );
        if (existingResult) {
          return existingResult.responseData as PaymentResult;
        }
      }

      // Get or create customer
      let customer = await this.customerService.findByUserId(dto.userId);
      if (!customer) {
        // Create customer with minimal data for now
        customer = await this.customerService.create({
          userId: dto.userId,
          email: `user-${dto.userId}@temp.com`, // Temporary - should get from user service
          name: `User ${dto.userId}`, // Temporary - should get from user service
        });
      }

      // Fraud detection
      const fraudScore = await this.fraudDetectionService.analyzePayment({
        amount: dto.amount,
        currency: dto.currency,
        userId: dto.userId,
        customerId: customer.id,
      });

      if (fraudScore.riskLevel === 'high') {
        throw new BadRequestException('Payment blocked due to fraud detection');
      }

      // Create Stripe payment intent
      const stripePaymentIntent = await this.stripeService.createPaymentIntent({
        ...dto,
        customerId: customer.stripeCustomerId,
      });

      // Create transaction record
      const transaction = await this.transactionService.create({
        customerId: customer.id,
        type: TransactionType.PAYMENT,
        provider: PaymentProvider.STRIPE,
        providerTransactionId: stripePaymentIntent.id,
        amount: dto.amount,
        currency: dto.currency,
        description: dto.description,
        status: TransactionStatus.PENDING,
        providerData: {
          clientSecret: stripePaymentIntent.client_secret,
          paymentMethodTypes: stripePaymentIntent.payment_method_types,
        },
        metadata: dto.metadata,
        fraudScore,
      });

      // Create audit trail
      await this.auditService.logPaymentEvent({
        transactionId: transaction.id,
        userId: dto.userId,
        action: 'payment_intent_created',
        details: {
          amount: dto.amount,
          currency: dto.currency,
          provider: PaymentProvider.STRIPE,
          fraudScore: fraudScore.score,
        },
      });

      const result: PaymentResult = {
        transactionId: transaction.id,
        status: TransactionStatus.PENDING,
        clientSecret: stripePaymentIntent.client_secret,
        requiresAction: stripePaymentIntent.status === 'requires_action',
        nextAction: stripePaymentIntent.next_action,
      };

      // Store idempotency result if key provided
      if (idempotencyKey) {
        await this.idempotencyService.storeResult(
          idempotencyKey,
          'completed',
          result,
        );
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Payment intent created: ${transaction.id} for user: ${dto.userId}`,
      );
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to create payment intent: ${error.message}`);

      if (idempotencyKey) {
        await this.idempotencyService.storeResult(idempotencyKey, 'failed', {
          errorMessage: error.message,
        });
      }

      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async processPayment(dto: ProcessPaymentDto): Promise<PaymentResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transaction = await this.transactionService.findById(
        dto.transactionId,
      );
      if (!transaction) {
        throw new NotFoundException('Transaction not found');
      }

      if (transaction.status !== TransactionStatus.PENDING) {
        throw new BadRequestException(
          `Transaction cannot be processed in status: ${transaction.status}`,
        );
      }

      // Update transaction status
      await this.transactionService.updateStatus(
        transaction.id,
        TransactionStatus.PROCESSING,
        dto.userId,
        'Payment processing initiated',
      );

      // Queue background processing
      await this.paymentQueue.add(
        'process-payment',
        {
          transactionId: transaction.id,
          paymentMethodId: dto.paymentMethodId,
          userId: dto.userId,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      await queryRunner.commitTransaction();

      return {
        transactionId: transaction.id,
        status: TransactionStatus.PROCESSING,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async refundPayment(dto: RefundPaymentDto): Promise<PaymentResult> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const originalTransaction = await this.transactionService.findById(
        dto.transactionId,
      );
      if (!originalTransaction) {
        throw new NotFoundException('Original transaction not found');
      }

      if (originalTransaction.status !== TransactionStatus.SUCCEEDED) {
        throw new BadRequestException(
          'Only successful transactions can be refunded',
        );
      }

      const refundAmount = dto.amount || originalTransaction.amount;
      const maxRefundAmount =
        originalTransaction.amount - originalTransaction.refundedAmount;

      if (refundAmount > maxRefundAmount) {
        throw new BadRequestException('Refund amount exceeds available amount');
      }

      // Create Stripe refund
      const stripeRefund = await this.stripeService.createRefund(
        originalTransaction.providerTransactionId,
        refundAmount,
        dto.reason,
      );

      // Create refund transaction record
      const refundTransaction = await this.transactionService.create({
        customerId: originalTransaction.customerId,
        type: TransactionType.REFUND,
        provider: originalTransaction.provider,
        providerTransactionId: stripeRefund.id,
        amount: refundAmount,
        currency: originalTransaction.currency,
        description: `Refund for transaction ${originalTransaction.id}`,
        status: TransactionStatus.SUCCEEDED,
        providerData: {
          originalTransactionId: originalTransaction.id,
          refundReason: dto.reason,
        },
        metadata: {
          originalTransactionId: originalTransaction.id,
          refundReason: dto.reason,
        },
      });

      // Update original transaction refunded amount
      await this.transactionService.updateRefundedAmount(
        originalTransaction.id,
        originalTransaction.refundedAmount + refundAmount,
      );

      // Update status if fully refunded
      if (
        originalTransaction.refundedAmount + refundAmount >=
        originalTransaction.amount
      ) {
        await this.transactionService.updateStatus(
          originalTransaction.id,
          TransactionStatus.REFUNDED,
          dto.userId,
          'Transaction fully refunded',
        );
      } else {
        await this.transactionService.updateStatus(
          originalTransaction.id,
          TransactionStatus.PARTIALLY_REFUNDED,
          dto.userId,
          `Partial refund of ${refundAmount}`,
        );
      }

      // Create audit trail
      await this.auditService.logPaymentEvent({
        transactionId: refundTransaction.id,
        userId: dto.userId,
        action: 'refund_processed',
        details: {
          originalTransactionId: originalTransaction.id,
          refundAmount,
          reason: dto.reason,
        },
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `Refund processed: ${refundTransaction.id} for original transaction: ${originalTransaction.id}`,
      );

      return {
        transactionId: refundTransaction.id,
        status: TransactionStatus.SUCCEEDED,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process refund: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getPaymentStatus(transactionId: string): Promise<Transaction> {
    const transaction = await this.transactionService.findById(transactionId);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }
    return transaction;
  }

  async getUserTransactions(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    return this.transactionService.findByUserId(userId, page, limit);
  }
}
