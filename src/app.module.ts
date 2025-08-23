import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PaymentsModule } from "./payments/payments.module";
import { MetricsModule } from "./metrics.module";
import { LoggerModule } from "./logger.module";
import { HealthModule } from "./health.module";
import { APMModule } from "./apm.module";
import { SecurityModule } from "./security/security.module";
import { RateLimitMiddleware } from "./security/rate-limit.middleware";
import { LoggingMiddleware } from "./security/logging.middleware";
import { ApiVersioningMiddleware } from "./security/api-versioning.middleware";
import { PayloadSizeMiddleware } from "./security/payload-size.middleware";
import { ComprehensiveSecurityMiddleware } from "./security/comprehensive-security.middleware";
import { EnhancedValidationMiddleware } from "./security/enhanced-validation.middleware";
import securityConfigFactory from "./security/security.config";
import * as Joi from "joi";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        NODE_ENV: Joi.string()
          .valid("development", "production", "test")
          .default("development"),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_PUBLISHABLE_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        REDIS_HOST: Joi.string().default("localhost"),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().optional(),
        // Security configuration
        ALLOWED_ORIGINS: Joi.string().optional(),
        ALLOWED_IPS: Joi.string().optional(),
        VALID_API_KEYS: Joi.string().optional(),
        ENABLE_IP_WHITELIST: Joi.boolean().default(false),
        ENABLE_API_KEYS: Joi.boolean().default(false),
        LOG_LEVEL: Joi.string()
          .valid("error", "warn", "info", "debug")
          .default("info"),
        // Payload size configuration
        MAX_PAYLOAD_SIZE: Joi.string().optional(),
        ENABLE_STREAM_MONITORING: Joi.boolean().default(true),
        ABORT_ON_OVERSIZE: Joi.boolean().default(true),
        LOG_OVERSIZE_ATTEMPTS: Joi.boolean().default(true),
        MAX_PARAMETERS: Joi.string().optional(),
      }),
      load: [securityConfigFactory],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DB_HOST"),
        port: configService.get("DB_PORT"),
        username: configService.get("DB_USERNAME"),
        password: configService.get("DB_PASSWORD"),
        database: configService.get("DB_NAME"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: configService.get("NODE_ENV") === "development",
      }),
      inject: [ConfigService],
    }),
    LoggerModule,
    MetricsModule,
    HealthModule,
    APMModule,
    PaymentsModule,
    SecurityModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply comprehensive security middleware in order
    consumer
      .apply(
        LoggingMiddleware,
        ComprehensiveSecurityMiddleware,
        RateLimitMiddleware,
        ApiVersioningMiddleware,
        PayloadSizeMiddleware,
        EnhancedValidationMiddleware,
      )
      .forRoutes("*");
  }
}
