import { PipeTransform, Injectable, BadRequestException } from '@nestjs/common';
import { SeasonalEventService } from '../services/seasonal-event.service';

@Injectable()
export class RewardCalculationPipe implements PipeTransform {
  constructor(private readonly eventService: SeasonalEventService) {}

  async transform(value: any) {
    // Validate and calculate rewards
    if (!value || !value.eventId || !value.userId) {
      throw new BadRequestException('Missing eventId or userId');
    }
    const event = await this.eventService['eventRepo'].findOne({ where: { id: value.eventId } });
    if (!event) throw new BadRequestException('Event not found');
    // Example: check if user is eligible for reward (stub)
    // You can expand this logic as needed
    if (!event.rewards) throw new BadRequestException('No rewards for this event');
    // Attach calculated rewards to request
    value.calculatedRewards = event.rewards;
    return value;
  }
} 