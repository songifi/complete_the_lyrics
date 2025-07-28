import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

// Entities
import { Customer } from './entities/customer.entity';
import { Transaction } from './entities/transaction.entity';
import { Subscription } from './entities/subscription.entity';
import { WebhookEvent } from './entities/webhook-event.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';

// Services
import { PaymentsService } from './services/payments.service';
import { StripeService } from './services/stripe.service';
import { WebhookService } from './services/webhook.service';
import { CustomerService } from './services/customer.service';
import { TransactionService } from './services/transaction.service';
import { SubscriptionService } from './services/subscription.service';
import { IdempotencyService } from './services/idempotency.service';
import { FraudDetectionService } from './services/fraud-detection.service';
import { AuditService } from './services/audit.service';

// Controllers
import { PaymentsController } from './controllers/payments.controller';
import { WebhookController } from './controllers/webhook.controller';
import { SubscriptionsController } from './controllers/subscriptions.controller';

// Processors
import { PaymentProcessor } from './processors/payment.processor';

// Guards
import { PaymentAuthGuard } from './guards/payment-auth.guard';
import { IdempotencyGuard } from './guards/idempotency.guard';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Customer,
      Transaction,
      Subscription,
      WebhookEvent,
      IdempotencyKey,
    ]),
    BullModule.registerQueueAsync({
      name: 'payment-processing',
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: configService.get('REDIS_PORT', 6379),
          password: configService.get('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: 'redis',
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        ttl: 300, // 5 minutes default TTL
      }),
      inject: [ConfigService],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 10, // 10 payment requests per minute per user
      },
    ]),
  ],
  controllers: [PaymentsController, WebhookController, SubscriptionsController],
  providers: [
    PaymentsService,
    StripeService,
    WebhookService,
    CustomerService,
    TransactionService,
    SubscriptionService,
    IdempotencyService,
    FraudDetectionService,
    AuditService,
    PaymentProcessor,
    PaymentAuthGuard,
    IdempotencyGuard,
  ],
  exports: [
    PaymentsService,
    StripeService,
    CustomerService,
    TransactionService,
    SubscriptionService,
  ],
})
export class PaymentsModule {}
