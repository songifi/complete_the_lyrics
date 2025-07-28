import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { PaymentsService, PaymentResult } from '../services/payments.service';
import { TransactionService } from '../services/transaction.service';
import { FraudDetectionService } from '../services/fraud-detection.service';
import { PaymentAuthGuard } from '../guards/payment-auth.guard';
import { IdempotencyGuard } from '../guards/idempotency.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { User } from '../../users/entities/user.entity';

import { CreatePaymentIntentDto } from '../dto/create-payment-intent.dto';
import {
  ProcessPaymentDto,
  RefundPaymentDto,
} from '../dto/process-payment.dto';

@Controller('payments')
@UseGuards(ThrottlerGuard, PaymentAuthGuard)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly transactionService: TransactionService,
    private readonly fraudDetectionService: FraudDetectionService,
  ) {}

  @Post('payment-intents')
  @UseGuards(IdempotencyGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPaymentIntent(
    @CurrentUser() user: User,
    @Body() dto: CreatePaymentIntentDto,
  ): Promise<PaymentResult> {
    // Ensure the user can only create payment intents for themselves
    dto.userId = user.id;

    this.logger.log(
      `Creating payment intent for user ${user.id}: ${dto.amount} ${dto.currency}`,
    );

    const result = await this.paymentsService.createPaymentIntent(
      dto,
      // @ts-ignore - idempotencyKey is added by IdempotencyGuard
      arguments[2]?.idempotencyKey,
    );

    return result;
  }

  @Post('payment-intents/:transactionId/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPaymentIntent(
    @CurrentUser() user: User,
    @Param('transactionId') transactionId: string,
    @Body() body: { paymentMethodId?: string },
  ): Promise<PaymentResult> {
    this.logger.log(
      `Confirming payment intent ${transactionId} for user ${user.id}`,
    );

    const dto: ProcessPaymentDto = {
      transactionId,
      userId: user.id,
      paymentMethodId: body.paymentMethodId,
    };

    return this.paymentsService.processPayment(dto);
  }

  @Post('refunds')
  @HttpCode(HttpStatus.CREATED)
  async createRefund(
    @CurrentUser() user: User,
    @Body() dto: RefundPaymentDto,
  ): Promise<PaymentResult> {
    // Ensure the user can only refund their own transactions
    dto.userId = user.id;

    this.logger.log(
      `Creating refund for transaction ${dto.transactionId} by user ${user.id}`,
    );

    return this.paymentsService.refundPayment(dto);
  }

  @Get('transactions')
  async getMyTransactions(
    @CurrentUser() user: User,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
  ) {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 10, 50); // Max 50 per page

    this.logger.log(
      `Fetching transactions for user ${user.id} (page ${pageNum})`,
    );

    const result = await this.paymentsService.getUserTransactions(
      user.id,
      pageNum,
      limitNum,
    );

    return {
      success: true,
      data: result,
    };
  }

  @Get('transactions/:transactionId')
  async getTransaction(
    @CurrentUser() user: User,
    @Param('transactionId') transactionId: string,
  ) {
    this.logger.log(
      `Fetching transaction ${transactionId} for user ${user.id}`,
    );

    const transaction =
      await this.paymentsService.getPaymentStatus(transactionId);

    // Verify ownership (the PaymentAuthGuard also checks this, but double-check)
    if (transaction.customer?.userId !== user.id && user.role !== 'admin') {
      throw new Error('Access denied to transaction');
    }

    return {
      success: true,
      data: transaction,
    };
  }

  @Patch('transactions/:transactionId/flag')
  async flagTransaction(
    @CurrentUser() user: User,
    @Param('transactionId') transactionId: string,
    @Body() body: { reason: string },
  ) {
    this.logger.log(
      `Flagging transaction ${transactionId} by user ${user.id}: ${body.reason}`,
    );

    const transaction = await this.transactionService.flagTransaction(
      transactionId,
      body.reason,
      user.id,
    );

    // Also report to fraud detection service
    await this.fraudDetectionService.reportFraud(
      transactionId,
      user.id,
      body.reason,
    );

    return {
      success: true,
      message: 'Transaction flagged successfully',
      data: transaction,
    };
  }

  @Get('config')
  async getPaymentConfig() {
    // Return public configuration needed by frontend
    return {
      success: true,
      data: {
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        supportedCurrencies: ['usd', 'eur', 'gbp'],
        maxTransactionAmount: 999999.99,
        minTransactionAmount: 0.5,
      },
    };
  }

  @Get('stats')
  async getPaymentStats(
    @CurrentUser() user: User,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.log(`Fetching payment stats for user ${user.id}`);

    // Get user's customer record first
    const customer = await this.transactionService.findByUserId(user.id, 1, 1);
    if (!customer || customer.transactions.length === 0) {
      return {
        success: true,
        data: {
          totalTransactions: 0,
          totalAmount: 0,
          successfulTransactions: 0,
          failedTransactions: 0,
          refundedAmount: 0,
          averageAmount: 0,
        },
      };
    }

    const stats = await this.transactionService.getTransactionStats(
      customer.transactions[0]?.customerId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );

    return {
      success: true,
      data: stats,
    };
  }

  @Post('fraud-analysis')
  async analyzeFraud(
    @CurrentUser() user: User,
    @Body()
    body: {
      amount: number;
      currency: string;
      ipAddress?: string;
      userAgent?: string;
      deviceFingerprint?: string;
    },
  ) {
    this.logger.log(`Performing fraud analysis for user ${user.id}`);

    // This endpoint is for testing fraud detection
    // In production, this would be called internally during payment processing
    const customerId = 'temp-customer-id'; // Would get from customer service

    const fraudScore = await this.fraudDetectionService.analyzePayment({
      amount: body.amount,
      currency: body.currency,
      userId: user.id,
      customerId,
      ipAddress: body.ipAddress,
      userAgent: body.userAgent,
      deviceFingerprint: body.deviceFingerprint,
    });

    return {
      success: true,
      data: fraudScore,
    };
  }
}
