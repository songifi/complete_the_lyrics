import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('seasonal-event-reward')
export class SeasonalEventRewardProcessor {
  private readonly logger = new Logger(SeasonalEventRewardProcessor.name);

  @Process()
  async handleReward(job: Job) {
    const { userId, eventId } = job.data;
    this.logger.log(`Processing event reward for user ${userId} in event ${eventId}`);
    // TODO: Implement actual reward distribution logic (e.g., update DB, notify user)
  }
} 