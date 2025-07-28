import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Stripe from 'stripe';

import {
  Subscription,
  SubscriptionStatus,
  BillingInterval,
} from '../entities/subscription.entity';
import { StripeService } from './stripe.service';
import { AuditService } from './audit.service';

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly stripeService: StripeService,
    private readonly auditService: AuditService,
  ) {}

  async createFromStripeSubscription(
    stripeSubscription: Stripe.Subscription,
    customerId: string,
  ): Promise<Subscription> {
    try {
      const subscription = this.subscriptionRepository.create({
        customerId,
        providerSubscriptionId: stripeSubscription.id,
        status: this.mapStripeStatus(stripeSubscription.status),
        planId: stripeSubscription.items.data[0]?.price?.id || 'unknown',
        planName:
          stripeSubscription.items.data[0]?.price?.nickname || 'Subscription',
        amount:
          (stripeSubscription.items.data[0]?.price?.unit_amount || 0) / 100,
        currency: stripeSubscription.items.data[0]?.price?.currency || 'usd',
        billingInterval: this.mapStripeBillingInterval(
          stripeSubscription.items.data[0]?.price?.recurring?.interval ||
            'month',
        ),
        billingIntervalCount:
          stripeSubscription.items.data[0]?.price?.recurring?.interval_count ||
          1,
        currentPeriodStart: new Date(
          stripeSubscription.current_period_start * 1000,
        ),
        currentPeriodEnd: new Date(
          stripeSubscription.current_period_end * 1000,
        ),
        trialStart: stripeSubscription.trial_start
          ? new Date(stripeSubscription.trial_start * 1000)
          : null,
        trialEnd: stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000)
          : null,
        cancelledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        metadata: stripeSubscription.metadata,
      });

      const savedSubscription =
        await this.subscriptionRepository.save(subscription);

      await this.auditService.logPaymentEvent({
        customerId,
        action: 'subscription_created',
        details: {
          subscriptionId: savedSubscription.id,
          providerSubscriptionId: stripeSubscription.id,
          planId: subscription.planId,
          amount: subscription.amount,
          currency: subscription.currency,
        },
      });

      this.logger.log(`Subscription created: ${savedSubscription.id}`);
      return savedSubscription;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw error;
    }
  }

  async findById(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: ['customer'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  async findByCustomerId(
    customerId: string,
    status?: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    subscriptions: Subscription[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const queryBuilder = this.subscriptionRepository
      .createQueryBuilder('subscription')
      .where('subscription.customerId = :customerId', { customerId });

    if (status) {
      queryBuilder.andWhere('subscription.status = :status', { status });
    }

    const [subscriptions, total] = await queryBuilder
      .orderBy('subscription.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      subscriptions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(
    id: string,
    updateData: {
      priceId?: string;
      cancelAtPeriodEnd?: boolean;
      metadata?: Record<string, string>;
    },
  ): Promise<Subscription> {
    const subscription = await this.findById(id);

    try {
      // Update in Stripe first
      if (updateData.priceId) {
        // Change subscription plan
        await this.stripeService.updateSubscription(
          subscription.providerSubscriptionId,
          updateData.priceId,
        );
      }

      if (updateData.cancelAtPeriodEnd !== undefined) {
        await this.stripeService.cancelSubscription(
          subscription.providerSubscriptionId,
          updateData.cancelAtPeriodEnd,
        );
      }

      // Update local record
      if (updateData.metadata) {
        subscription.metadata = {
          ...subscription.metadata,
          ...updateData.metadata,
        };
      }

      if (updateData.cancelAtPeriodEnd !== undefined) {
        subscription.cancelAtPeriodEnd = updateData.cancelAtPeriodEnd;
      }

      const updatedSubscription =
        await this.subscriptionRepository.save(subscription);

      await this.auditService.logPaymentEvent({
        customerId: subscription.customerId,
        action: 'subscription_updated',
        details: {
          subscriptionId: subscription.id,
          changes: updateData,
        },
      });

      this.logger.log(`Subscription updated: ${id}`);
      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Failed to update subscription: ${error.message}`);
      throw error;
    }
  }

  async cancel(
    id: string,
    cancelAtPeriodEnd: boolean = true,
  ): Promise<Subscription> {
    const subscription = await this.findById(id);

    try {
      // Cancel in Stripe
      const canceledStripeSubscription =
        await this.stripeService.cancelSubscription(
          subscription.providerSubscriptionId,
          cancelAtPeriodEnd,
        );

      // Update local record
      subscription.status = cancelAtPeriodEnd
        ? SubscriptionStatus.ACTIVE // Still active until period end
        : SubscriptionStatus.CANCELLED;
      subscription.cancelAtPeriodEnd = cancelAtPeriodEnd;
      subscription.cancelledAt = cancelAtPeriodEnd ? null : new Date();

      const updatedSubscription =
        await this.subscriptionRepository.save(subscription);

      await this.auditService.logPaymentEvent({
        customerId: subscription.customerId,
        action: 'subscription_cancelled',
        details: {
          subscriptionId: subscription.id,
          cancelAtPeriodEnd,
          cancelledAt: subscription.cancelledAt,
        },
      });

      this.logger.log(
        `Subscription cancelled: ${id} (at period end: ${cancelAtPeriodEnd})`,
      );
      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw error;
    }
  }

  async reactivate(id: string): Promise<Subscription> {
    const subscription = await this.findById(id);

    if (
      subscription.status !== SubscriptionStatus.CANCELLED &&
      !subscription.cancelAtPeriodEnd
    ) {
      throw new Error(
        'Subscription is not cancelled or scheduled for cancellation',
      );
    }

    try {
      // Reactivate in Stripe by removing cancel_at_period_end
      await this.stripeService.updateSubscription(
        subscription.providerSubscriptionId,
        undefined, // No price change
        { cancel_at_period_end: false },
      );

      // Update local record
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.cancelAtPeriodEnd = false;
      subscription.cancelledAt = null;

      const updatedSubscription =
        await this.subscriptionRepository.save(subscription);

      await this.auditService.logPaymentEvent({
        customerId: subscription.customerId,
        action: 'subscription_reactivated',
        details: {
          subscriptionId: subscription.id,
        },
      });

      this.logger.log(`Subscription reactivated: ${id}`);
      return updatedSubscription;
    } catch (error) {
      this.logger.error(`Failed to reactivate subscription: ${error.message}`);
      throw error;
    }
  }

  async syncWithStripe(providerSubscriptionId: string): Promise<Subscription> {
    try {
      // Get latest data from Stripe
      const stripeSubscription = await this.stripeService.getSubscription(
        providerSubscriptionId,
      );

      // Find local subscription
      const subscription = await this.subscriptionRepository.findOne({
        where: { providerSubscriptionId },
      });

      if (!subscription) {
        throw new NotFoundException('Local subscription not found');
      }

      // Update local record with Stripe data
      subscription.status = this.mapStripeStatus(stripeSubscription.status);
      subscription.currentPeriodStart = new Date(
        stripeSubscription.current_period_start * 1000,
      );
      subscription.currentPeriodEnd = new Date(
        stripeSubscription.current_period_end * 1000,
      );
      subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;
      subscription.cancelledAt = stripeSubscription.canceled_at
        ? new Date(stripeSubscription.canceled_at * 1000)
        : null;

      const updatedSubscription =
        await this.subscriptionRepository.save(subscription);

      this.logger.log(`Subscription synced with Stripe: ${subscription.id}`);
      return updatedSubscription;
    } catch (error) {
      this.logger.error(
        `Failed to sync subscription with Stripe: ${error.message}`,
      );
      throw error;
    }
  }

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    switch (stripeStatus) {
      case 'active':
        return SubscriptionStatus.ACTIVE;
      case 'inactive':
        return SubscriptionStatus.INACTIVE;
      case 'canceled':
        return SubscriptionStatus.CANCELLED;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'paused':
        return SubscriptionStatus.PAUSED;
      default:
        return SubscriptionStatus.INACTIVE;
    }
  }

  private mapStripeBillingInterval(stripeInterval: string): BillingInterval {
    switch (stripeInterval) {
      case 'day':
        return BillingInterval.DAY;
      case 'week':
        return BillingInterval.WEEK;
      case 'month':
        return BillingInterval.MONTH;
      case 'year':
        return BillingInterval.YEAR;
      default:
        return BillingInterval.MONTH;
    }
  }
}
