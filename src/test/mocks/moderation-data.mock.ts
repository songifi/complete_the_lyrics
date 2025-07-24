import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';
import { ContentType } from '../../common/enums/content-type.enum';

export const mockModerationCases = [
  {
    id: '1',
    contentId: 'content-1',
    contentType: ContentType.TEXT,
    content: 'Clean content',
    status: ModerationStatus.APPROVED,
    escalationLevel: EscalationLevel.LOW,
    confidenceScore: 0.1,
    createdAt: new Date('2023-01-01'),
    updatedAt: new Date('2023-01-01'),
  },
  {
    id: '2',
    contentId: 'content-2',
    contentType: ContentType.TEXT,
    content: 'Toxic content',
    status: ModerationStatus.REJECTED,
    escalationLevel: EscalationLevel.HIGH,
    confidenceScore: 0.9,
    rejectionReason: 'Contains hate speech',
    createdAt: new Date('2023-01-02'),
    updatedAt: new Date('2023-01-02'),
  },
];

export const mockModerationRules = [
  {
    id: 'rule-1',
    name: 'Toxicity Detection',
    description: 'Detects toxic language and hate speech',
    applicableContentType: ContentType.TEXT,
    conditions: { toxicityThreshold: 0.5 },
    actions: { autoReject: true },
    escalationLevel: EscalationLevel.HIGH,
    isActive: true,
    priority: 10,
  },
  {
    id: 'rule-2',
    name: 'Adult Content Detection',
    description: 'Detects adult content in images',
    applicableContentType: ContentType.IMAGE,
    conditions: { adultContentThreshold: 0.7 },
    actions: { escalate: true },
    escalationLevel: EscalationLevel.CRITICAL,
    isActive: true,
    priority: 20,
  },
];
