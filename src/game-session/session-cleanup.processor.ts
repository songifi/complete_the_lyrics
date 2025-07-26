import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { GameSessionService } from './services/game-session.service';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { Inject, LoggerService } from '@nestjs/common';

@Processor('session-cleanup')
export class SessionCleanupProcessor {
  constructor(
    private readonly sessionService: GameSessionService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  @Process()
  async handleCleanup(job: Job) {
    const { sessionId } = job.data;
    await this.sessionService.endSession(sessionId);
    this.logger.log('Session cleanup processed', { sessionId });
  }
}
