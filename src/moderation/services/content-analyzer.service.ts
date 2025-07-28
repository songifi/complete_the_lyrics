import { Injectable, Logger } from '@nestjs/common';
import { ContentType } from '../../common/enums/content-type.enum';
import { ModerationResult } from '../../common/interfaces/moderation-result.interface';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';
import { TextAnalyzerService } from './text-analyzer.service';
import { ImageAnalyzerService } from './image-analyzer.service';

@Injectable()
export class ContentAnalyzerService {
  private readonly logger = new Logger(ContentAnalyzerService.name);

  constructor(
    private readonly textAnalyzer: TextAnalyzerService,
    private readonly imageAnalizer: ImageAnalyzerService,
  ) {}

  async analyzeContent(
    content: string,
    contentType: ContentType,
    contentId: string,
  ): Promise<ModerationResult> {
    this.logger.log(`Analyzing content ${contentId} of type ${contentType}`);

    try {
      switch (contentType) {
        case ContentType.TEXT:
          return await this.textAnalyzer.analyze(content);
        case ContentType.IMAGE:
          return await this.imageAnalizer.analyze(content);
        default:
          return this.createDefaultResult();
      }
    } catch (error) {
      this.logger.error(`Content analysis failed for ${contentId}:`, error);
      return this.createErrorResult();
    }
  }

  private createDefaultResult(): ModerationResult {
    return {
      isViolation: false,
      confidence: 0,
      ruleIds: [],
      escalationLevel: EscalationLevel.LOW,
    };
  }

  private createErrorResult(): ModerationResult {
    return {
      isViolation: false,
      confidence: 0,
      ruleIds: [],
      escalationLevel: EscalationLevel.MEDIUM,
      metadata: { error: 'Analysis failed' },
    };
  }
}
