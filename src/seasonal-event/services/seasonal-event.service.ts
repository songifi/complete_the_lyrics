import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeasonalEvent } from '../entities/seasonal-event.entity';
import * as moment from 'moment-timezone';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SeasonalEventAnalyticsService } from './seasonal-event-analytics.service';

@Injectable()
export class SeasonalEventService {
  private readonly logger = new Logger(SeasonalEventService.name);

  constructor(
    @InjectRepository(SeasonalEvent)
    private readonly eventRepo: Repository<SeasonalEvent>,
    @InjectQueue('seasonal-event-reward')
    private readonly rewardQueue: Queue,
    private readonly analyticsService: SeasonalEventAnalyticsService,
  ) {}

  // Schedule and activate events
  async scheduleEvents() {
    const now = moment.tz(moment(), 'UTC');
    const events = await this.eventRepo.find();
    for (const event of events) {
      const isActive = now.isBetween(moment(event.startTime), moment(event.endTime));
      if (isActive && !event.isActive && this.isFeatureEnabled(event)) {
        event.isActive = true;
        this.logger.log(`Activating event: ${event.name}`);
        // Optionally: emit WebSocket event
      } else if ((!isActive || !this.isFeatureEnabled(event)) && event.isActive) {
        event.isActive = false;
        this.logger.log(`Deactivating event: ${event.name}`);
        // Optionally: emit WebSocket event
      }
      await this.eventRepo.save(event);
    }
  }

  isFeatureEnabled(event: SeasonalEvent): boolean {
    // Simple feature flag check (can be expanded)
    return !event.featureFlags || event.featureFlags.enabled !== false;
  }

  // Track participation
  async trackParticipation(userId: string, eventId: string) {
    await this.analyticsService.trackParticipation(userId, eventId);
  }

  // Process rewards
  async processRewards(userId: string, eventId: string) {
    await this.analyticsService.trackCompletion(userId, eventId);
    // Enqueue reward job
    await this.rewardQueue.add({ userId, eventId });
    this.logger.log(`Enqueued reward processing for user ${userId} in event ${eventId}`);
  }
} 