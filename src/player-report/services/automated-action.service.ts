import { Injectable } from '@nestjs/common';
import { BullQueueService } from '../queue/bull-queue.service';
import { PlayerReport } from '../entities/player-report.entity';

@Injectable()
export class AutomatedActionService {
  constructor(private readonly bullQueue: BullQueueService) {}

  async processActions(report: PlayerReport) {
    if (report.category === 'abuse' && report.priority === 'high') {
      await this.bullQueue.addJob({ type: 'suspend', playerId: report.reportedPlayerId });
      report.automatedActions = [ ...(report.automatedActions || []), { action: 'suspend', date: new Date() } ];
    } else if (report.category === 'spam') {
      await this.bullQueue.addJob({ type: 'warn', playerId: report.reportedPlayerId });
      report.automatedActions = [ ...(report.automatedActions || []), { action: 'warn', date: new Date() } ];
    }
  }
}
