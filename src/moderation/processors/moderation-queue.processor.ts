import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { ModerationService } from '../services/moderation.service';

@Processor('moderation')
export class ModerationQueueProcessor {
  private readonly logger = new Logger(ModerationQueueProcessor.name);

  constructor(private readonly moderationService: ModerationService) {}

  @Process('analyze-content')
  async handleContentAnalysis(
    job: Job<{ caseId: string; contentType: string; content: string }>,
  ) {
    this.logger.log(`Processing content analysis for case ${job.data.caseId}`);

    try {
      await this.moderationService.processAutomatedModeration(job.data.caseId);
      this.logger.log(`Completed analysis for case ${job.data.caseId}`);
    } catch (error) {
      this.logger.error(`Failed to analyze case ${job.data.caseId}:`, error);
      throw error;
    }
  }

  @Process('manual-review')
  async handleManualReview(
    job: Job<{ caseId: string; escalationLevel: string }>,
  ) {
    this.logger.log(`Processing manual review for case ${job.data.caseId}`);

    // This job just logs that manual review is needed
    // Actual review is done through the API endpoints
    this.logger.log(
      `Case ${job.data.caseId} requires manual review at ${job.data.escalationLevel} level`,
    );
  }
}
