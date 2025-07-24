import { SetMetadata } from '@nestjs/common';

export const CONTENT_ANALYSIS_KEY = 'content_analysis';

export interface ContentAnalysisOptions {
  enableTextAnalysis?: boolean;
  enableImageAnalysis?: boolean;
  escalationThreshold?: number;
  customRules?: string[];
}

export const ContentAnalysis = (options: ContentAnalysisOptions = {}) =>
  SetMetadata(CONTENT_ANALYSIS_KEY, options);
