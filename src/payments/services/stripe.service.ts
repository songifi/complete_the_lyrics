import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { PaymentProvider } from '../entities/transaction.entity';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private readonly configService: ConfigService) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is required');
    }

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
      appInfo: {
        name: 'complete-the-lyrics-payment',
        version: '1.0.0',
      },
    });
  }

  async createPaymentIntent(
    dto: CreatePaymentIntentDto,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const params: Stripe.PaymentIntentCreateParams = {
        amount: Math.round(dto.amount * 100), // Convert to cents
        currency: dto.currency.toLowerCase(),
        payment_method_types: dto.paymentMethodTypes || ['card'],
        metadata: {
          userId: dto.userId,
          ...(dto.metadata || {}),
        },
      };

      if (dto.customerId) {
        params.customer = dto.customerId;
      }

      if (dto.description) {
        params.description = dto.description;
      }

      // Automatic payment methods if enabled
      if (dto.automaticPaymentMethods) {
        params.automatic_payment_methods = {
          enabled: true,
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create(params);

      this.logger.log(`Payment intent created: ${paymentIntent.id}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to create payment intent: ${error.message}`);
      throw new BadRequestException(
        `Payment intent creation failed: ${error.message}`,
      );
    }
  }

  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethodId?: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const params: Stripe.PaymentIntentConfirmParams = {};

      if (paymentMethodId) {
        params.payment_method = paymentMethodId;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        params,
      );

      this.logger.log(`Payment intent confirmed: ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to confirm payment intent: ${error.message}`);
      throw new BadRequestException(
        `Payment confirmation failed: ${error.message}`,
      );
    }
  }

  async createCustomer(dto: CreateCustomerDto): Promise<Stripe.Customer> {
    try {
      const params: Stripe.CustomerCreateParams = {
        email: dto.email,
        name: dto.name,
        metadata: {
          userId: dto.userId,
          ...(dto.metadata || {}),
        },
      };

      if (dto.phone) {
        params.phone = dto.phone;
      }

      if (dto.address) {
        params.address = dto.address;
      }

      const customer = await this.stripe.customers.create(params);

      this.logger.log(`Customer created: ${customer.id}`);
      return customer;
    } catch (error) {
      this.logger.error(`Failed to create customer: ${error.message}`);
      throw new BadRequestException(
        `Customer creation failed: ${error.message}`,
      );
    }
  }

  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      const customer = (await this.stripe.customers.retrieve(
        customerId,
      )) as Stripe.Customer;
      return customer;
    } catch (error) {
      this.logger.error(`Failed to retrieve customer: ${error.message}`);
      throw new BadRequestException(
        `Customer retrieval failed: ${error.message}`,
      );
    }
  }

  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string,
  ): Promise<Stripe.Refund> {
    try {
      const params: Stripe.RefundCreateParams = {
        payment_intent: paymentIntentId,
      };

      if (amount) {
        params.amount = Math.round(amount * 100); // Convert to cents
      }

      if (reason) {
        params.reason = reason as Stripe.RefundCreateParams.Reason;
      }

      const refund = await this.stripe.refunds.create(params);

      this.logger.log(
        `Refund created: ${refund.id} for payment intent: ${paymentIntentId}`,
      );
      return refund;
    } catch (error) {
      this.logger.error(`Failed to create refund: ${error.message}`);
      throw new BadRequestException(`Refund creation failed: ${error.message}`);
    }
  }

  async createSubscription(
    customerId: string,
    priceId: string,
    metadata?: Record<string, string>,
  ): Promise<Stripe.Subscription> {
    try {
      const params: Stripe.SubscriptionCreateParams = {
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
      };

      if (metadata) {
        params.metadata = metadata;
      }

      const subscription = await this.stripe.subscriptions.create(params);

      this.logger.log(`Subscription created: ${subscription.id}`);
      return subscription;
    } catch (error) {
      this.logger.error(`Failed to create subscription: ${error.message}`);
      throw new BadRequestException(
        `Subscription creation failed: ${error.message}`,
      );
    }
  }

  async cancelSubscription(
    subscriptionId: string,
    cancelAtPeriodEnd: boolean = false,
  ): Promise<Stripe.Subscription> {
    try {
      let subscription: Stripe.Subscription;

      if (cancelAtPeriodEnd) {
        subscription = await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      } else {
        subscription = await this.stripe.subscriptions.cancel(subscriptionId);
      }

      this.logger.log(
        `Subscription ${cancelAtPeriodEnd ? 'scheduled for cancellation' : 'cancelled'}: ${subscriptionId}`,
      );
      return subscription;
    } catch (error) {
      this.logger.error(`Failed to cancel subscription: ${error.message}`);
      throw new BadRequestException(
        `Subscription cancellation failed: ${error.message}`,
      );
    }
  }

  async getPaymentIntent(
    paymentIntentId: string,
  ): Promise<Stripe.PaymentIntent> {
    try {
      const paymentIntent =
        await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      this.logger.error(`Failed to retrieve payment intent: ${error.message}`);
      throw new BadRequestException(
        `Payment intent retrieval failed: ${error.message}`,
      );
    }
  }

  async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    try {
      const subscription =
        await this.stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      this.logger.error(`Failed to retrieve subscription: ${error.message}`);
      throw new BadRequestException(
        `Subscription retrieval failed: ${error.message}`,
      );
    }
  }

  async updateSubscription(
    subscriptionId: string,
    priceId?: string,
    updateParams?: Partial<Stripe.SubscriptionUpdateParams>,
  ): Promise<Stripe.Subscription> {
    try {
      const params: Stripe.SubscriptionUpdateParams = {
        ...updateParams,
      };

      if (priceId) {
        params.items = [
          {
            id: subscriptionId, // This would need the actual subscription item ID
            price: priceId,
          },
        ];
      }

      const subscription = await this.stripe.subscriptions.update(
        subscriptionId,
        params,
      );

      this.logger.log(`Subscription updated: ${subscriptionId}`);
      return subscription;
    } catch (error) {
      this.logger.error(`Failed to update subscription: ${error.message}`);
      throw new BadRequestException(
        `Subscription update failed: ${error.message}`,
      );
    }
  }

  async constructWebhookEvent(
    payload: Buffer,
    signature: string,
  ): Promise<Stripe.Event> {
    try {
      const webhookSecret = this.configService.get<string>(
        'STRIPE_WEBHOOK_SECRET',
      );
      if (!webhookSecret) {
        throw new Error('STRIPE_WEBHOOK_SECRET is required');
      }

      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
      return event;
    } catch (error) {
      this.logger.error(
        `Webhook signature verification failed: ${error.message}`,
      );
      throw new BadRequestException('Webhook signature verification failed');
    }
  }

  getProvider(): PaymentProvider {
    return PaymentProvider.STRIPE;
  }
}
