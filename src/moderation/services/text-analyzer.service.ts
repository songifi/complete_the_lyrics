import { Injectable, Logger } from '@nestjs/common';
import { ModerationResult } from '../../common/interfaces/moderation-result.interface';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';
import * as natural from 'natural';

@Injectable()
export class TextAnalyzerService {
  private readonly logger = new Logger(TextAnalyzerService.name);
  private readonly toxicWords = ['spam', 'hate', 'abuse', 'toxic']; // Simplified for demo

  async analyze(text: string): Promise<ModerationResult> {
    const analysis = {
      sentiment: natural.SentimentAnalyzer.analyze(text),
      toxicity: this.detectToxicity(text),
      spam: this.detectSpam(text),
    };

    const violationScore = this.calculateViolationScore(analysis);
    const isViolation = violationScore > 0.5;
    const escalationLevel = this.determineEscalationLevel(violationScore);

    return {
      isViolation,
      confidence: violationScore,
      escalationLevel,
      ruleIds: this.getAppliedRules(analysis),
      metadata: analysis,
    };
  }

  private detectToxicity(text: string): number {
    const words = text.toLowerCase().split(/\s+/);
    const toxicCount = words.filter((word) =>
      this.toxicWords.includes(word),
    ).length;
    return Math.min((toxicCount / words.length) * 2, 1);
  }

  private detectSpam(text: string): number {
    const hasExcessiveCaps = text.match(/[A-Z]/g)?.length / text.length > 0.5;
    const hasRepeatedChars = /(.)\1{3,}/.test(text);
    return (hasExcessiveCaps ? 0.3 : 0) + (hasRepeatedChars ? 0.4 : 0);
  }

  private calculateViolationScore(analysis: any): number {
    return Math.max(analysis.toxicity, analysis.spam);
  }

  private determineEscalationLevel(score: number): EscalationLevel {
    if (score > 0.8) return EscalationLevel.CRITICAL;
    if (score > 0.6) return EscalationLevel.HIGH;
    if (score > 0.4) return EscalationLevel.MEDIUM;
    return EscalationLevel.LOW;
  }

  private getAppliedRules(analysis: any): string[] {
    const rules = [];
    if (analysis.toxicity > 0.3) rules.push('toxicity-rule');
    if (analysis.spam > 0.3) rules.push('spam-rule');
    return rules;
  }
}
