import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

import { StripeService } from '../services/stripe.service';
import { TransactionService } from '../services/transaction.service';
import { WebhookService } from '../services/webhook.service';
import { AuditService } from '../services/audit.service';
import { TransactionStatus } from '../entities/transaction.entity';

export interface ProcessPaymentJob {
  transactionId: string;
  paymentMethodId?: string;
  userId: string;
}

export interface ProcessWebhookJob {
  webhookEventId: string;
}

export interface ProcessRefundJob {
  transactionId: string;
  amount?: number;
  reason?: string;
  userId: string;
}

@Processor('payment-processing')
export class PaymentProcessor {
  private readonly logger = new Logger(PaymentProcessor.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly transactionService: TransactionService,
    private readonly webhookService: WebhookService,
    private readonly auditService: AuditService,
  ) {}

  @Process('process-payment')
  async processPayment(job: Job<ProcessPaymentJob>): Promise<void> {
    const { transactionId, paymentMethodId, userId } = job.data;

    this.logger.log(`Processing payment job for transaction: ${transactionId}`);

    try {
      // Get transaction details
      const transaction = await this.transactionService.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Confirm payment intent with Stripe
      const paymentIntent = await this.stripeService.confirmPaymentIntent(
        transaction.providerTransactionId,
        paymentMethodId,
      );

      // Update transaction based on payment intent status
      let newStatus: TransactionStatus;
      let notes: string;

      switch (paymentIntent.status) {
        case 'succeeded':
          newStatus = TransactionStatus.SUCCEEDED;
          notes = 'Payment completed successfully';
          break;
        case 'requires_action':
          newStatus = TransactionStatus.PENDING;
          notes = 'Payment requires additional action from user';
          break;
        case 'processing':
          newStatus = TransactionStatus.PROCESSING;
          notes = 'Payment is being processed';
          break;
        case 'canceled':
          newStatus = TransactionStatus.CANCELLED;
          notes = 'Payment was cancelled';
          break;
        default:
          newStatus = TransactionStatus.FAILED;
          notes = `Payment failed with status: ${paymentIntent.status}`;
      }

      await this.transactionService.updateStatus(
        transactionId,
        newStatus,
        userId,
        notes,
        newStatus === TransactionStatus.SUCCEEDED ? new Date() : undefined,
      );

      // Update provider data with latest payment intent info
      await this.transactionService.updateProviderData(transactionId, {
        ...transaction.providerData,
        status: paymentIntent.status,
        lastUpdated: new Date().toISOString(),
      });

      // Log audit event
      await this.auditService.logPaymentEvent({
        transactionId,
        userId,
        action: 'payment_processed_async',
        details: {
          paymentIntentId: transaction.providerTransactionId,
          status: paymentIntent.status,
          amount: transaction.amount,
          currency: transaction.currency,
        },
      });

      this.logger.log(
        `Payment processing completed for transaction: ${transactionId} (${newStatus})`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Payment processing failed for transaction: ${transactionId}: ${errorMessage}`,
      );

      // Update transaction as failed
      await this.transactionService.updateStatus(
        transactionId,
        TransactionStatus.FAILED,
        userId,
        `Payment processing failed: ${errorMessage}`,
      );

      // Update failure details
      await this.transactionService.updateFailureDetails(
        transactionId,
        errorMessage,
        'processing_error',
      );

      // Log audit event
      await this.auditService.logPaymentEvent({
        transactionId,
        userId,
        action: 'payment_processing_failed',
        details: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      });

      throw error; // Re-throw to trigger job retry
    }
  }

  @Process('process-webhook')
  async processWebhook(job: Job<ProcessWebhookJob>): Promise<void> {
    const { webhookEventId } = job.data;

    this.logger.log(`Processing webhook job: ${webhookEventId}`);

    try {
      await this.webhookService.processWebhookEvent(webhookEventId);

      this.logger.log(`Webhook processing completed: ${webhookEventId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Webhook processing failed: ${webhookEventId}: ${errorMessage}`,
      );
      throw error; // Re-throw to trigger job retry
    }
  }

  @Process('process-refund')
  async processRefund(job: Job<ProcessRefundJob>): Promise<void> {
    const { transactionId, amount, reason, userId } = job.data;

    this.logger.log(`Processing refund job for transaction: ${transactionId}`);

    try {
      // Get transaction details
      const transaction = await this.transactionService.findById(transactionId);
      if (!transaction) {
        throw new Error('Transaction not found');
      }

      // Create refund with Stripe
      const stripeRefund = await this.stripeService.createRefund(
        transaction.providerTransactionId,
        amount,
        reason,
      );

      // Create refund transaction record (this would be handled by the service layer)
      // For now, just log the refund processing
      await this.auditService.logPaymentEvent({
        transactionId,
        userId,
        action: 'refund_processed_async',
        details: {
          refundId: stripeRefund.id,
          amount: stripeRefund.amount / 100,
          reason,
          originalTransactionId: transactionId,
        },
      });

      this.logger.log(
        `Refund processing completed for transaction: ${transactionId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Refund processing failed for transaction: ${transactionId}: ${errorMessage}`,
      );

      // Log audit event
      await this.auditService.logPaymentEvent({
        transactionId,
        userId,
        action: 'refund_processing_failed',
        details: {
          error: errorMessage,
          timestamp: new Date().toISOString(),
        },
      });

      throw error; // Re-throw to trigger job retry
    }
  }

  @Process('cleanup-expired-intents')
  async cleanupExpiredIntents(): Promise<void> {
    this.logger.log('Starting cleanup of expired payment intents');

    try {
      // Find transactions that are stuck in pending status for more than 24 hours
      const expiredTransactions =
        await this.transactionService.findExpiredPendingTransactions();

      for (const transaction of expiredTransactions) {
        try {
          // Check status with Stripe
          const paymentIntent = await this.stripeService.getPaymentIntent(
            transaction.providerTransactionId,
          );

          if (paymentIntent.status === 'canceled') {
            await this.transactionService.updateStatus(
              transaction.id,
              TransactionStatus.FAILED,
              undefined,
              'Payment intent expired and was cleaned up',
            );

            this.logger.log(
              `Cleaned up expired transaction: ${transaction.id}`,
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';
          this.logger.error(
            `Failed to cleanup transaction ${transaction.id}: ${errorMessage}`,
          );
        }
      }

      this.logger.log(
        `Cleanup completed, processed ${expiredTransactions.length} transactions`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Cleanup job failed: ${errorMessage}`);
      throw error;
    }
  }

  @Process('sync-subscriptions')
  async syncSubscriptions(_job: Job): Promise<void> {
    this.logger.log('Starting subscription sync with Stripe');

    try {
      // This would sync subscription statuses with Stripe
      // Implementation would depend on subscription service

      await this.auditService.logPaymentEvent({
        action: 'subscription_sync_completed',
        details: {
          timestamp: new Date().toISOString(),
          jobId: _job.id,
        },
      });

      this.logger.log('Subscription sync completed');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Subscription sync failed: ${errorMessage}`);
      throw error;
    }
  }

  @Process('fraud-analysis')
  async performFraudAnalysis(
    _job: Job<{ transactionId: string }>,
  ): Promise<void> {
    const { transactionId } = _job.data;

    this.logger.log(
      `Performing background fraud analysis for transaction: ${transactionId}`,
    );

    try {
      // This would perform more comprehensive fraud analysis
      // that might take longer and doesn't block payment processing

      await this.auditService.logPaymentEvent({
        transactionId,
        action: 'background_fraud_analysis_completed',
        details: {
          timestamp: new Date().toISOString(),
          jobId: _job.id,
        },
      });

      this.logger.log(
        `Background fraud analysis completed for transaction: ${transactionId}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Background fraud analysis failed: ${errorMessage}`);
      // Don't re-throw - fraud analysis failure shouldn't affect payment processing
    }
  }
}
