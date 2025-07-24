import { Controller, Get, Post, Param, Body, UseGuards, UsePipes } from '@nestjs/common';
import { SeasonalEventService } from '../services/seasonal-event.service';
import { EventAccessGuard } from '../guards/event-access.guard';
import { RewardCalculationPipe } from '../pipes/reward-calculation.pipe';

@Controller('seasonal-event')
export class SeasonalEventController {
  constructor(private readonly eventService: SeasonalEventService) {}

  @Get('active')
  async getActiveEvents() {
    // TODO: Return currently active events
    return [];
  }

  @Post('join/:eventId/:userId')
  @UseGuards(EventAccessGuard)
  async joinEvent(@Param('eventId') eventId: string, @Param('userId') userId: string) {
    // TODO: Join event logic
    return { message: 'Joined event', eventId, userId };
  }

  @Post('claim-reward/:eventId/:userId')
  @UseGuards(EventAccessGuard)
  @UsePipes(RewardCalculationPipe)
  async claimReward(@Param('eventId') eventId: string, @Param('userId') userId: string, @Body() body: any) {
    // TODO: Claim reward logic
    return { message: 'Reward claimed', eventId, userId };
  }
} 