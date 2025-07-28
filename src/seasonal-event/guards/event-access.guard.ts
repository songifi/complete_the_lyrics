import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SeasonalEventService } from '../services/seasonal-event.service';
import { Request } from 'express';

@Injectable()
export class EventAccessGuard implements CanActivate {
  constructor(private readonly eventService: SeasonalEventService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req: Request = context.switchToHttp().getRequest();
    const eventId = req.params['eventId'];
    if (!eventId) throw new ForbiddenException('No eventId provided');
    const event = await this.eventService['eventRepo'].findOne({ where: { id: eventId } });
    if (!event) throw new ForbiddenException('Event not found');
    const now = new Date();
    const isActive = event.isActive && now >= new Date(event.startTime) && now <= new Date(event.endTime);
    if (!isActive || (event.featureFlags && event.featureFlags.enabled === false)) {
      throw new ForbiddenException('Event is not active or not enabled');
    }
    return true;
  }
} 