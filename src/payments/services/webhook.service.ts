import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import Stripe from 'stripe';

import {
  WebhookEvent,
  WebhookEventStatus,
  WebhookProvider,
} from '../entities/webhook-event.entity';
import { TransactionService } from './transaction.service';
import { SubscriptionService } from './subscription.service';
import { AuditService } from './audit.service';
import { StripeService } from './stripe.service';
import {
  TransactionStatus,
  TransactionType,
} from '../entities/transaction.entity';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly webhookEventRepository: Repository<WebhookEvent>,
    @InjectQueue('payment-processing')
    private readonly paymentQueue: Queue,
    private readonly stripeService: StripeService,
    private readonly transactionService: TransactionService,
    private readonly subscriptionService: SubscriptionService,
    private readonly auditService: AuditService,
  ) {}

  async processStripeWebhook(
    payload: Buffer,
    signature: string,
  ): Promise<void> {
    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = await this.stripeService.constructWebhookEvent(
        payload,
        signature,
      );
    } catch (error) {
      this.logger.error(
        `Stripe webhook signature verification failed: ${error.message}`,
      );
      throw new BadRequestException('Invalid webhook signature');
    }

    // Check if we've already processed this event
    const existingEvent = await this.webhookEventRepository.findOne({
      where: { providerEventId: event.id },
    });

    if (existingEvent) {
      this.logger.log(`Webhook event already processed: ${event.id}`);
      return;
    }

    // Store webhook event
    const webhookEvent = await this.webhookEventRepository.save({
      provider: WebhookProvider.STRIPE,
      providerEventId: event.id,
      eventType: event.type,
      status: WebhookEventStatus.PENDING,
      payload: event.data,
      signatureHeader: signature,
      signatureVerified: true,
    });

    this.logger.log(`Stored webhook event: ${webhookEvent.id} (${event.type})`);

    // Queue for processing
    await this.paymentQueue.add(
      'process-webhook',
      {
        webhookEventId: webhookEvent.id,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      },
    );
  }

  async processWebhookEvent(webhookEventId: string): Promise<void> {
    const webhookEvent = await this.webhookEventRepository.findOne({
      where: { id: webhookEventId },
    });

    if (!webhookEvent) {
      throw new Error(`Webhook event not found: ${webhookEventId}`);
    }

    if (webhookEvent.status !== WebhookEventStatus.PENDING) {
      this.logger.log(`Webhook event already processed: ${webhookEventId}`);
      return;
    }

    // Update status to processing
    await this.webhookEventRepository.update(webhookEventId, {
      status: WebhookEventStatus.PROCESSING,
    });

    try {
      await this.handleWebhookEvent(webhookEvent);

      // Mark as processed
      await this.webhookEventRepository.update(webhookEventId, {
        status: WebhookEventStatus.PROCESSED,
        processedAt: new Date(),
      });

      this.logger.log(`Successfully processed webhook: ${webhookEventId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process webhook ${webhookEventId}: ${error.message}`,
      );

      // Increment retry count
      webhookEvent.retryCount++;

      if (webhookEvent.retryCount >= webhookEvent.maxRetries) {
        await this.webhookEventRepository.update(webhookEventId, {
          status: WebhookEventStatus.FAILED,
          errorMessage: error.message,
          retryCount: webhookEvent.retryCount,
        });
      } else {
        // Calculate next retry time (exponential backoff)
        const nextRetryAt = new Date();
        nextRetryAt.setMinutes(
          nextRetryAt.getMinutes() + Math.pow(2, webhookEvent.retryCount),
        );

        await this.webhookEventRepository.update(webhookEventId, {
          status: WebhookEventStatus.PENDING,
          errorMessage: error.message,
          retryCount: webhookEvent.retryCount,
          nextRetryAt,
        });
      }

      throw error;
    }
  }

  private async handleWebhookEvent(webhookEvent: WebhookEvent): Promise<void> {
    const { eventType, payload } = webhookEvent;

    switch (eventType) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(payload);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(payload);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentIntentCanceled(payload);
        break;

      case 'invoice.payment_succeeded':
        await this.handleInvoicePaymentSucceeded(payload);
        break;

      case 'invoice.payment_failed':
        await this.handleInvoicePaymentFailed(payload);
        break;

      case 'customer.subscription.created':
        await this.handleSubscriptionCreated(payload);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(payload);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(payload);
        break;

      default:
        this.logger.log(`Unhandled webhook event type: ${eventType}`);
        break;
    }
  }

  private async handlePaymentIntentSucceeded(payload: any): Promise<void> {
    const paymentIntent = payload.object as Stripe.PaymentIntent;

    const transaction =
      await this.transactionService.findByProviderTransactionId(
        paymentIntent.id,
      );

    if (!transaction) {
      this.logger.warn(
        `Transaction not found for payment intent: ${paymentIntent.id}`,
      );
      return;
    }

    await this.transactionService.updateStatus(
      transaction.id,
      TransactionStatus.SUCCEEDED,
      null, // System update
      'Payment succeeded via webhook',
      new Date(),
    );

    await this.auditService.logPaymentEvent({
      transactionId: transaction.id,
      action: 'payment_succeeded_webhook',
      details: {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount_received / 100,
        currency: paymentIntent.currency,
      },
    });

    this.logger.log(`Payment succeeded: ${transaction.id}`);
  }

  private async handlePaymentIntentFailed(payload: any): Promise<void> {
    const paymentIntent = payload.object as Stripe.PaymentIntent;

    const transaction =
      await this.transactionService.findByProviderTransactionId(
        paymentIntent.id,
      );

    if (!transaction) {
      this.logger.warn(
        `Transaction not found for payment intent: ${paymentIntent.id}`,
      );
      return;
    }

    await this.transactionService.updateStatus(
      transaction.id,
      TransactionStatus.FAILED,
      null, // System update
      'Payment failed via webhook',
    );

    // Update failure details
    await this.transactionService.updateFailureDetails(
      transaction.id,
      paymentIntent.last_payment_error?.message || 'Payment failed',
      paymentIntent.last_payment_error?.code || 'unknown_error',
    );

    await this.auditService.logPaymentEvent({
      transactionId: transaction.id,
      action: 'payment_failed_webhook',
      details: {
        paymentIntentId: paymentIntent.id,
        errorMessage: paymentIntent.last_payment_error?.message,
        errorCode: paymentIntent.last_payment_error?.code,
      },
    });

    this.logger.log(`Payment failed: ${transaction.id}`);
  }

  private async handlePaymentIntentCanceled(payload: any): Promise<void> {
    const paymentIntent = payload.object as Stripe.PaymentIntent;

    const transaction =
      await this.transactionService.findByProviderTransactionId(
        paymentIntent.id,
      );

    if (!transaction) {
      this.logger.warn(
        `Transaction not found for payment intent: ${paymentIntent.id}`,
      );
      return;
    }

    await this.transactionService.updateStatus(
      transaction.id,
      TransactionStatus.CANCELLED,
      null, // System update
      'Payment canceled via webhook',
    );

    this.logger.log(`Payment canceled: ${transaction.id}`);
  }

  private async handleInvoicePaymentSucceeded(payload: any): Promise<void> {
    const invoice = payload.object as Stripe.Invoice;
    this.logger.log(`Invoice payment succeeded: ${invoice.id}`);
    // Handle subscription payment success
  }

  private async handleInvoicePaymentFailed(payload: any): Promise<void> {
    const invoice = payload.object as Stripe.Invoice;
    this.logger.log(`Invoice payment failed: ${invoice.id}`);
    // Handle subscription payment failure
  }

  private async handleSubscriptionCreated(payload: any): Promise<void> {
    const subscription = payload.object as Stripe.Subscription;
    this.logger.log(`Subscription created: ${subscription.id}`);
    // Handle subscription creation
  }

  private async handleSubscriptionUpdated(payload: any): Promise<void> {
    const subscription = payload.object as Stripe.Subscription;
    this.logger.log(`Subscription updated: ${subscription.id}`);
    // Handle subscription updates
  }

  private async handleSubscriptionDeleted(payload: any): Promise<void> {
    const subscription = payload.object as Stripe.Subscription;
    this.logger.log(`Subscription deleted: ${subscription.id}`);
    // Handle subscription deletion
  }
}
