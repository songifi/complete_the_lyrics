import { EscalationLevel } from "../enums/escalation-level.enum";

export interface ModerationResult {
  isViolation: boolean;
  confidence: number;
  violationType?: string;
  ruleIds: string[];
  escalationLevel: EscalationLevel;
  metadata?: Record<string, any>;
}