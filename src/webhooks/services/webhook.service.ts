import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ModerationCase } from '../../moderation/entities/moderation-case.entity';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';

export interface WebhookPayload {
  event: string;
  caseId: string;
  contentId: string;
  status: ModerationStatus;
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly webhookUrls: string[] =
    process.env.WEBHOOK_URLS?.split(',') || [];

  constructor(private readonly httpService: HttpService) {}

  async sendModerationUpdate(
    moderationCase: ModerationCase,
    event: string,
  ): Promise<void> {
    const payload: WebhookPayload = {
      event,
      caseId: moderationCase.id,
      contentId: moderationCase.contentId,
      status: moderationCase.status,
      timestamp: new Date(),
      metadata: {
        escalationLevel: moderationCase.escalationLevel,
        confidenceScore: moderationCase.confidenceScore,
        appliedRules: moderationCase.appliedRuleIds,
      },
    };

    await Promise.allSettled(
      this.webhookUrls.map((url) => this.sendWebhook(url, payload)),
    );
  }

  private async sendWebhook(
    url: string,
    payload: WebhookPayload,
  ): Promise<void> {
    try {
      await this.httpService
        .post(url, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': this.generateSignature(payload),
          },
          timeout: 5000,
        })
        .toPromise();

      this.logger.log(`Webhook sent successfully to ${url}`);
    } catch (error) {
      this.logger.error(`Failed to send webhook to ${url}:`, error.message);
    }
  }

  private generateSignature(payload: WebhookPayload): string {
    // Implement HMAC signature generation for security
    const crypto = require('crypto');
    const secret = process.env.WEBHOOK_SECRET || 'default-secret';
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
}
