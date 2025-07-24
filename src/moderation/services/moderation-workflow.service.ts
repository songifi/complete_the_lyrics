import { Injectable, Logger } from '@nestjs/common';
import { interpret } from 'xstate';
import {
  moderationStateMachine,
  ModerationContext,
} from '../workflows/moderation-state-machine';

@Injectable()
export class ModerationWorkflowService {
  private readonly logger = new Logger(ModerationWorkflowService.name);
  private readonly activeWorkflows = new Map();

  transition(
    caseId: string,
    event: string,
    context?: Partial<ModerationContext>,
  ): void {
    let service = this.activeWorkflows.get(caseId);

    if (!service) {
      service = interpret(
        moderationStateMachine.withContext({
          caseId,
          confidenceScore: context?.confidenceScore || 0,
          escalationLevel: context?.escalationLevel || 'low',
          ...context,
        }),
      );

      service.start();
      this.activeWorkflows.set(caseId, service);
    }

    this.logger.log(`Transitioning case ${caseId} with event ${event}`);
    service.send(event);
  }

  getCurrentState(caseId: string): string {
    const service = this.activeWorkflows.get(caseId);
    return service?.state?.value || 'unknown';
  }

  stopWorkflow(caseId: string): void {
    const service = this.activeWorkflows.get(caseId);
    if (service) {
      service.stop();
      this.activeWorkflows.delete(caseId);
    }
  }
}
