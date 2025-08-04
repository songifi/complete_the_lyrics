import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

// Entities
import {
  GameRoomEntity,
  RoomMemberEntity,
  RoomActivityEntity,
  RoomTemplateEntity,
  RoomModerationEntity,
} from './entities';

// Services
import { RoomManagementService } from './services/room-management.service';
import { RoomModerationService } from './services/room-moderation.service';
import { RedisPubSubService } from './services/redis-pubsub.service';
import { RoomQueueService } from './services/room-queue.service';
import { AuthService } from './services/auth.service';

// Guards
import { RoomAccessGuard, RoomModerationGuard, RoomJwtGuard, RoomJwtService } from './guards';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { RoomJwtStrategy } from './strategies/room-jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

// Interceptors
import { ActivityLoggingInterceptor } from './interceptors/activity-logging.interceptor';

// Gateways
import { RoomGateway } from './gateways/room.gateway';

// Controllers
import { RoomManagementController } from './controllers/room-management.controller';

// Processors
import { RoomCleanupProcessor } from './processors/room-cleanup.processor';

@Module({
  imports: [
    // TypeORM entities
    TypeOrmModule.forFeature([
      GameRoomEntity,
      RoomMemberEntity,
      RoomActivityEntity,
      RoomTemplateEntity,
      RoomModerationEntity,
    ]),

    // JWT Module for room-specific tokens
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('ROOM_JWT_SECRET') || 'room-secret',
        signOptions: {
          expiresIn: configService.get<string>('ROOM_JWT_EXPIRES_IN') || '24h',
        },
      }),
      inject: [ConfigService],
    }),

    // Bull Queue for background processing
    BullModule.registerQueueAsync({
      name: 'room-cleanup',
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        redis: {
          host: configService.get<string>('REDIS_HOST') || 'localhost',
          port: configService.get<number>('REDIS_PORT') || 6379,
          password: configService.get<string>('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      }),
      inject: [ConfigService],
    }),

    // Passport for authentication strategies
    PassportModule.register({ defaultStrategy: 'jwt' }),

    // Config module
    ConfigModule,
  ],

  controllers: [RoomManagementController],

  providers: [
    // Core services
    RoomManagementService,
    RoomModerationService,
    RedisPubSubService,
    RoomQueueService,
    AuthService,

    // JWT service
    RoomJwtService,

    // Guards
    RoomAccessGuard,
    RoomModerationGuard,
    RoomJwtGuard,

    // Strategies
    JwtStrategy,
    RoomJwtStrategy,
    LocalStrategy,

    // Interceptors
    ActivityLoggingInterceptor,

    // Gateways
    RoomGateway,

    // Processors
    RoomCleanupProcessor,
  ],

  exports: [
    // Services for use in other modules
    RoomManagementService,
    RoomModerationService,
    RedisPubSubService,
    RoomQueueService,
    AuthService,
    RoomJwtService,

    // Guards for use in other modules
    RoomAccessGuard,
    RoomModerationGuard,
    RoomJwtGuard,

    // Strategies for use in other modules
    JwtStrategy,
    RoomJwtStrategy,
    LocalStrategy,

    // Interceptors for use in other modules
    ActivityLoggingInterceptor,

    // Gateways for use in other modules
    RoomGateway,

    // TypeORM repositories for use in other modules
    TypeOrmModule,
  ],
})
export class RoomManagementModule {
  constructor() {
    // Module initialization logic if needed
  }
}
