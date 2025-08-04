import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { WebhookService } from '../services/webhook.service';
import { AuditService } from '../services/audit.service';

@Controller('payments/webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly auditService: AuditService,
  ) {}

  @Post('stripe')
  @HttpCode(HttpStatus.OK)
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const startTime = Date.now();

    try {
      if (!signature) {
        this.logger.error('Missing Stripe signature header');
        throw new Error('Missing Stripe signature header');
      }

      // Get raw body - this should be configured in main.ts to preserve raw body for webhooks
      const payload = req.rawBody || req.body;
      if (!payload) {
        this.logger.error('Missing webhook payload');
        throw new Error('Missing webhook payload');
      }

      this.logger.log(
        `Received Stripe webhook with signature: ${signature.substring(0, 20)}...`,
      );

      // Process the webhook
      await this.webhookService.processStripeWebhook(payload, signature);

      const processingTime = Date.now() - startTime;
      this.logger.log(
        `Stripe webhook processed successfully in ${processingTime}ms`,
      );

      // Log successful webhook processing
      await this.auditService.logWebhookEvent({
        webhookEventId: 'immediate-processing',
        provider: 'stripe',
        eventType: 'webhook_received',
        processed: true,
      });

      return { received: true };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.logger.error(
        `Stripe webhook processing failed in ${processingTime}ms: ${error.message}`,
      );

      // Log failed webhook processing
      await this.auditService.logWebhookEvent({
        webhookEventId: 'immediate-processing-failed',
        provider: 'stripe',
        eventType: 'webhook_failed',
        processed: false,
        errorMessage: error.message,
      });

      // Stripe expects a 200 response even for processing errors to prevent retries
      // We'll handle retries internally through our queue system
      return { received: true };
    }
  }

  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  async handlePayPalWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string>,
  ): Promise<{ received: boolean }> {
    this.logger.log('PayPal webhook received (not implemented yet)');

    // TODO: Implement PayPal webhook handling
    // This would be similar to Stripe but with PayPal-specific verification

    return { received: true };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  async handleTestWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ): Promise<{ received: boolean; data: any }> {
    // This endpoint is for testing webhook functionality in development
    // Should be disabled in production

    if (process.env.NODE_ENV === 'production') {
      this.logger.warn('Test webhook endpoint called in production');
      return { received: false, data: null };
    }

    this.logger.log('Test webhook received:', JSON.stringify(body, null, 2));

    return {
      received: true,
      data: {
        body,
        headers: Object.keys(headers),
        timestamp: new Date().toISOString(),
      },
    };
  }
}
