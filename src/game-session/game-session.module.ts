import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from '@nestjs/redis';
import { GameSession } from './entities/game-session.entity';
import { GameSessionService } from './services/game-session.service';
import { GameSessionGateway } from './session.gateway';
import { SessionAccessGuard } from './guards/session-access.guard';
import { SessionCleanupProcessor } from './session-cleanup.processor';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Module({
  imports: [
    TypeOrmModule.forFeature([GameSession]),
    BullModule.registerQueue({ name: 'session-cleanup' }),
    RedisModule,
  ],
  providers: [
    GameSessionService,
    GameSessionGateway,
    SessionAccessGuard,
    SessionCleanupProcessor,
    { provide: WINSTON_MODULE_NEST_PROVIDER, useValue: null },
  ],
  exports: [GameSessionService],
})
export class GameSessionModule {}
