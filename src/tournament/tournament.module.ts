import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtModule } from '@nestjs/jwt';
// Note: Using ioredis directly instead of @nestjs/redis which doesn't exist

// Entities
import { Tournament } from './entities/tournament.entity';
import { TournamentParticipant } from './entities/tournament-participant.entity';
import { Match } from './entities/match.entity';
import { MatchResult } from './entities/match-result.entity';
import { Bracket } from './entities/bracket.entity';
import { PrizeDistribution } from './entities/prize-distribution.entity';
import { TournamentEvent } from './entities/tournament-event.entity';

// Controllers
import { TournamentController } from './controllers/tournament.controller';

// Services
import { TournamentService } from './services/tournament.service';
import { TournamentCacheService } from './services/tournament-cache.service';
import { TournamentEligibilityService } from './services/tournament-eligibility.service';
import { PrizeCalculatorService } from './services/prize-calculator.service';
import { MatchSchedulerService } from './services/match-scheduler.service';

// Algorithms
import { BracketGeneratorService } from './algorithms/bracket-generator.service';
import { SeedingService } from './algorithms/seeding.service';

// Processors
import { MatchProcessingProcessor } from './processors/match-processing.processor';

// Gateways
import { TournamentGateway } from './gateways/tournament.gateway';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { TournamentOwnerGuard } from './guards/tournament-owner.guard';
import { RateLimitGuard } from './guards/rate-limit.guard';
import { WsJwtGuard } from './guards/ws-jwt.guard';

// Interceptors
import { CacheInterceptor } from './interceptors/cache.interceptor';
import { LoggingInterceptor } from './interceptors/logging.interceptor';

// Event Listeners
import { TournamentEventListeners } from './events/tournament.listeners';

// Validators
import {
  IsFutureDateConstraint,
  IsValidDateRangeConstraint,
  IsValidParticipantCountConstraint,
  IsValidTournamentFormatConstraint,
  IsValidPrizePoolConstraint,
  IsValidRegistrationPeriodConstraint,
} from './validators/tournament.validators';

@Module({
  imports: [
    // TypeORM for database entities
    TypeOrmModule.forFeature([
      Tournament,
      TournamentParticipant,
      Match,
      MatchResult,
      Bracket,
      PrizeDistribution,
      TournamentEvent,
    ]),

    // Bull Queue for job processing
    BullModule.registerQueue(
      {
        name: 'match-processing',
        defaultJobOptions: {
          removeOnComplete: 10,
          removeOnFail: 5,
        },
      },
      {
        name: 'notification',
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 10,
        },
      },
    ),

    // JWT for authentication
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'tournament-secret',
      signOptions: { expiresIn: '24h' },
    }),

    // Redis is configured via the REDIS_CLIENT provider below

    // Event Emitter for event handling
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 10,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),

    // Schedule for cron jobs
    ScheduleModule.forRoot(),
  ],

  controllers: [TournamentController],

  providers: [
    // Core Services
    TournamentService,
    TournamentCacheService,
    TournamentEligibilityService,
    PrizeCalculatorService,
    MatchSchedulerService,

    // Algorithm Services
    BracketGeneratorService,
    SeedingService,

    // Processors
    MatchProcessingProcessor,

    // Gateways
    TournamentGateway,

    // Guards
    JwtAuthGuard,
    TournamentOwnerGuard,
    RateLimitGuard,
    WsJwtGuard,

    // Interceptors
    CacheInterceptor,
    LoggingInterceptor,

    // Event Listeners
    TournamentEventListeners,

    // Custom Validators
    IsFutureDateConstraint,
    IsValidDateRangeConstraint,
    IsValidParticipantCountConstraint,
    IsValidTournamentFormatConstraint,
    IsValidPrizePoolConstraint,
    IsValidRegistrationPeriodConstraint,

    // Redis Client Provider
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => {
        const Redis = require('ioredis');
        return new Redis({
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379'),
          password: process.env.REDIS_PASSWORD,
          db: parseInt(process.env.REDIS_DB || '0'),
          retryDelayOnFailover: 100,
          enableReadyCheck: false,
          maxRetriesPerRequest: null,
        });
      },
    },
  ],

  exports: [
    TournamentService,
    TournamentCacheService,
    BracketGeneratorService,
    SeedingService,
    TournamentGateway,
    'REDIS_CLIENT',
  ],
})
export class TournamentModule {}
