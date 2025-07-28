import { Module } from "@nestjs/common"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { ThrottlerModule } from "@nestjs/throttler"
import { ConfigModule } from "@nestjs/config"

import { NotificationController } from "./controllers/notification.controller"
import { NotificationService } from "./services/notification.service"
import { NotificationPreferenceService } from "./services/notification-preference.service"
import { EmailService } from "./services/email.service"
import { PushNotificationService } from "./services/push-notification.service"
import { CacheService } from "./services/cache.service"

import { NotificationGateway } from "./gateways/notification.gateway"
import { NotificationProcessor } from "./processors/notification.processor"
import { NotificationLoggingInterceptor } from "./interceptors/notification-logging.interceptor"

import { Notification } from "./entities/notification.entity"
import { NotificationPreference } from "./entities/notification-preference.entity"
import { NotificationAnalytics } from "./entities/notification-analytics.entity"

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Notification, NotificationPreference, NotificationAnalytics]),
    BullModule.registerQueue({
      name: "notification",
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationPreferenceService,
    EmailService,
    PushNotificationService,
    CacheService,
    NotificationGateway,
    NotificationProcessor,
    NotificationLoggingInterceptor,
  ],
  exports: [NotificationService, NotificationPreferenceService, NotificationGateway],
})
export class NotificationModule {}
