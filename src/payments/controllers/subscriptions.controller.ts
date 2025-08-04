import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { SubscriptionService } from '../services/subscription.service';
import { StripeService } from '../services/stripe.service';
import { CustomerService } from '../services/customer.service';
import { PaymentAuthGuard } from '../guards/payment-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { User } from '../../users/entities/user.entity';

export class CreateSubscriptionDto {
  priceId: string;
  metadata?: Record<string, string>;
}

export class UpdateSubscriptionDto {
  priceId?: string;
  cancelAtPeriodEnd?: boolean;
  metadata?: Record<string, string>;
}

@Controller('payments/subscriptions')
@UseGuards(ThrottlerGuard, PaymentAuthGuard)
export class SubscriptionsController {
  private readonly logger = new Logger(SubscriptionsController.name);

  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly stripeService: StripeService,
    private readonly customerService: CustomerService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSubscription(
    @CurrentUser() user: User,
    @Body() dto: CreateSubscriptionDto,
  ) {
    this.logger.log(
      `Creating subscription for user ${user.id} with price ${dto.priceId}`,
    );

    // Get or create customer
    let customer = await this.customerService.findByUserId(user.id);
    if (!customer) {
      // Create customer with user data
      customer = await this.customerService.create({
        userId: user.id,
        email: user.email,
        name: user.username,
      });
    }

    // Create Stripe subscription
    const stripeSubscription = await this.stripeService.createSubscription(
      customer.stripeCustomerId,
      dto.priceId,
      {
        userId: user.id,
        ...dto.metadata,
      },
    );

    // Create local subscription record
    const subscription =
      await this.subscriptionService.createFromStripeSubscription(
        stripeSubscription,
        customer.id,
      );

    return {
      success: true,
      data: {
        subscription,
        clientSecret: (stripeSubscription.latest_invoice as any)?.payment_intent
          ?.client_secret,
      },
    };
  }

  @Get()
  async getMySubscriptions(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 10, 50);

    this.logger.log(`Fetching subscriptions for user ${user.id}`);

    const customer = await this.customerService.findByUserId(user.id);
    if (!customer) {
      return {
        success: true,
        data: {
          subscriptions: [],
          total: 0,
          page: pageNum,
          totalPages: 0,
        },
      };
    }

    const result = await this.subscriptionService.findByCustomerId(
      customer.id,
      status,
      pageNum,
      limitNum,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Get(':subscriptionId')
  async getSubscription(
    @CurrentUser() user: User,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    this.logger.log(
      `Fetching subscription ${subscriptionId} for user ${user.id}`,
    );

    const subscription =
      await this.subscriptionService.findById(subscriptionId);

    // Verify ownership
    if (subscription.customer?.userId !== user.id && user.role !== 'admin') {
      throw new Error('Access denied to subscription');
    }

    return {
      success: true,
      data: subscription,
    };
  }

  @Patch(':subscriptionId')
  async updateSubscription(
    @CurrentUser() user: User,
    @Param('subscriptionId') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    this.logger.log(
      `Updating subscription ${subscriptionId} for user ${user.id}`,
    );

    const subscription =
      await this.subscriptionService.findById(subscriptionId);

    // Verify ownership
    if (subscription.customer?.userId !== user.id && user.role !== 'admin') {
      throw new Error('Access denied to subscription');
    }

    const updatedSubscription = await this.subscriptionService.update(
      subscriptionId,
      dto,
    );

    return {
      success: true,
      data: updatedSubscription,
    };
  }

  @Delete(':subscriptionId')
  async cancelSubscription(
    @CurrentUser() user: User,
    @Param('subscriptionId') subscriptionId: string,
    @Query('cancelAtPeriodEnd') cancelAtPeriodEnd: string = 'true',
  ) {
    const cancelAtEnd = cancelAtPeriodEnd !== 'false';

    this.logger.log(
      `Canceling subscription ${subscriptionId} for user ${user.id} (at period end: ${cancelAtEnd})`,
    );

    const subscription =
      await this.subscriptionService.findById(subscriptionId);

    // Verify ownership
    if (subscription.customer?.userId !== user.id && user.role !== 'admin') {
      throw new Error('Access denied to subscription');
    }

    const canceledSubscription = await this.subscriptionService.cancel(
      subscriptionId,
      cancelAtEnd,
    );

    return {
      success: true,
      message: cancelAtEnd
        ? 'Subscription will be canceled at the end of the current period'
        : 'Subscription canceled immediately',
      data: canceledSubscription,
    };
  }

  @Post(':subscriptionId/reactivate')
  async reactivateSubscription(
    @CurrentUser() user: User,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    this.logger.log(
      `Reactivating subscription ${subscriptionId} for user ${user.id}`,
    );

    const subscription =
      await this.subscriptionService.findById(subscriptionId);

    // Verify ownership
    if (subscription.customer?.userId !== user.id && user.role !== 'admin') {
      throw new Error('Access denied to subscription');
    }

    const reactivatedSubscription =
      await this.subscriptionService.reactivate(subscriptionId);

    return {
      success: true,
      message: 'Subscription reactivated successfully',
      data: reactivatedSubscription,
    };
  }

  @Get(':subscriptionId/invoices')
  async getSubscriptionInvoices(
    @CurrentUser() user: User,
    @Param('subscriptionId') subscriptionId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    this.logger.log(`Fetching invoices for subscription ${subscriptionId}`);

    const subscription =
      await this.subscriptionService.findById(subscriptionId);

    // Verify ownership
    if (subscription.customer?.userId !== user.id && user.role !== 'admin') {
      throw new Error('Access denied to subscription');
    }

    // TODO: Implement invoice fetching from Stripe
    // This would call Stripe API to get invoices for the subscription

    return {
      success: true,
      data: {
        invoices: [],
        total: 0,
        message: 'Invoice functionality coming soon',
      },
    };
  }
}
