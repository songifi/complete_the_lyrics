import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { WebhookService } from '../services/webhook.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post('external-moderation')
  async handleExternalModerationResult(
    @Body() payload: any,
    @Headers('x-webhook-signature') signature: string,
  ): Promise<void> {
    // Verify webhook signature
    if (!this.verifySignature(payload, signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Process external moderation result
    // This would integrate with third-party moderation services
    console.log('Received external moderation result:', payload);
  }

  private verifySignature(payload: any, signature: string): boolean {
    const crypto = require('crypto');
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return signature === expectedSignature;
  }
}
