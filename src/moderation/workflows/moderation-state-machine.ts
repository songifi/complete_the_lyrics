/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { createMachine, assign } from 'xstate';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';

export interface ModerationContext {
  caseId: string;
  confidenceScore: number;
  escalationLevel: string;
  moderatorId?: string;
}

export const moderationStateMachine = createMachine({
  id: 'moderation',
  initial: ModerationStatus.PENDING,
  context: {
    caseId: '',
    confidenceScore: 0,
    escalationLevel: 'low',
  } as ModerationContext,
  states: {
    [ModerationStatus.PENDING]: {
      on: {
        AUTO_APPROVE: ModerationStatus.APPROVED,
        AUTO_REJECT: ModerationStatus.REJECTED,
        ESCALATE: ModerationStatus.ESCALATED,
        ASSIGN_REVIEWER: ModerationStatus.UNDER_REVIEW,
      },
    },
    [ModerationStatus.UNDER_REVIEW]: {
      on: {
        APPROVE: ModerationStatus.APPROVED,
        REJECT: ModerationStatus.REJECTED,
        ESCALATE: ModerationStatus.ESCALATED,
      },
    },
    [ModerationStatus.APPROVED]: {
      on: {
        APPEAL: ModerationStatus.APPEALED,
      },
    },
    [ModerationStatus.REJECTED]: {
      on: {
        APPEAL: ModerationStatus.APPEALED,
      },
    },
    [ModerationStatus.ESCALATED]: {
      on: {
        APPROVE: ModerationStatus.APPROVED,
        REJECT: ModerationStatus.REJECTED,
        ASSIGN_REVIEWER: ModerationStatus.UNDER_REVIEW,
      },
    },
    [ModerationStatus.APPEALED]: {
      on: {
        APPROVE_APPEAL: ModerationStatus.APPROVED,
        REJECT_APPEAL: ModerationStatus.REJECTED,
      },
    },
  },
});
