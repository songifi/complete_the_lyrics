import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsModule } from './payments/payments.module';
import { MetricsModule } from './metrics.module';
import { LoggerModule } from './logger.module';
import { HealthModule } from './health.module';
import { APMModule } from './apm.module';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        STRIPE_SECRET_KEY: Joi.string().required(),
        STRIPE_PUBLISHABLE_KEY: Joi.string().required(),
        STRIPE_WEBHOOK_SECRET: Joi.string().required(),
        REDIS_HOST: Joi.string().default('localhost'),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().optional(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
    LoggerModule,
    MetricsModule,
    HealthModule,
    APMModule,
    PaymentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
