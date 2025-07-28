import { Injectable, Logger } from '@nestjs/common';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { ModerationResult } from '../../common/interfaces/moderation-result.interface';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';

@Injectable()
export class ImageAnalyzerService {
  private readonly logger = new Logger(ImageAnalyzerService.name);
  private readonly visionClient = new ImageAnnotatorClient();

  async analyze(imageUrl: string): Promise<ModerationResult> {
    try {
      const [result] = await this.visionClient.safeSearchDetection(imageUrl);
      const safeSearch = result.safeSearchAnnotation;

      const violationScore = this.calculateViolationScore(safeSearch);
      const isViolation = violationScore > 0.5;
      const escalationLevel = this.determineEscalationLevel(violationScore);

      return {
        isViolation,
        confidence: violationScore,
        escalationLevel,
        ruleIds: this.getAppliedRules(safeSearch),
        metadata: { safeSearch },
      };
    } catch (error) {
      this.logger.error('Image analysis failed:', error);
      return {
        isViolation: false,
        confidence: 0,
        ruleIds: [],
        escalationLevel: EscalationLevel.LOW,
        metadata: { error: 'Analysis failed' },
      };
    }
  }

  private calculateViolationScore(safeSearch: any): number {
    const scoreMap = {
      VERY_UNLIKELY: 0,
      UNLIKELY: 0.2,
      POSSIBLE: 0.5,
      LIKELY: 0.8,
      VERY_LIKELY: 1,
    };

    const scores = [
      scoreMap[safeSearch?.adult] || 0,
      scoreMap[safeSearch?.violence] || 0,
      scoreMap[safeSearch?.racy] || 0,
    ];

    return Math.max(...scores);
  }

  private determineEscalationLevel(score: number): EscalationLevel {
    if (score > 0.8) return EscalationLevel.CRITICAL;
    if (score > 0.6) return EscalationLevel.HIGH;
    if (score > 0.4) return EscalationLevel.MEDIUM;
    return EscalationLevel.LOW;
  }

  private getAppliedRules(safeSearch: any): string[] {
    const rules = [];
    if (safeSearch?.adult === 'LIKELY' || safeSearch?.adult === 'VERY_LIKELY') {
      rules.push('adult-content-rule');
    }
    if (
      safeSearch?.violence === 'LIKELY' ||
      safeSearch?.violence === 'VERY_LIKELY'
    ) {
      rules.push('violence-rule');
    }
    return rules;
  }
}
