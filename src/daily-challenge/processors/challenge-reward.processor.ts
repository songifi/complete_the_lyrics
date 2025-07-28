import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';

@Processor('challenge-reward')
export class ChallengeRewardProcessor {
  private readonly logger = new Logger(ChallengeRewardProcessor.name);

  @Process()
  async handleReward(job: Job) {
    const { userId, date } = job.data;
    this.logger.log(`Processing challenge reward for user ${userId} on ${date}`);
    // TODO: Implement actual reward distribution logic (e.g., update DB, notify user)
  }
} 