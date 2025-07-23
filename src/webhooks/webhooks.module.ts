import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { WebhookService } from './services/webhook.service';
import { WebhooksController } from './controllers/webhooks.controller';

@Module({
  imports: [HttpModule],
  controllers: [WebhooksController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhooksModule {}
