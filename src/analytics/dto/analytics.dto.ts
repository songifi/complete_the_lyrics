import { IsString, IsNumber, IsOptional, IsEnum, IsArray, IsObject, IsBoolean, IsDateString, Min, Max, IsUUID, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PerformanceLevel } from '../entities/player-performance.entity';
import { PatternType, PatternSeverity } from '../entities/answer-pattern.entity';
import { SessionType, SessionStatus } from '../entities/analytics-session.entity';

export class CreatePlayerPerformanceDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalRoundsPlayed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCorrectAnswers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalIncorrectAnswers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPointsEarned?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averageResponseTime?: number;

  @IsOptional()
  @IsEnum(PerformanceLevel)
  performanceLevel?: PerformanceLevel;
}

export class UpdatePlayerPerformanceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalRoundsPlayed?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalCorrectAnswers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalIncorrectAnswers?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  totalPointsEarned?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averageResponseTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fastestResponseTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  slowestResponseTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  accuracyRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averagePointsPerRound?: number;

  @IsOptional()
  @IsEnum(PerformanceLevel)
  performanceLevel?: PerformanceLevel;

  @IsOptional()
  @IsObject()
  categoryPerformance?: Record<string, any>;

  @IsOptional()
  @IsObject()
  difficultyPerformance?: Record<string, any>;

  @IsOptional()
  @IsObject()
  questionTypePerformance?: Record<string, any>;

  @IsOptional()
  @IsArray()
  recentSessions?: Array<any>;

  @IsOptional()
  @IsObject()
  learningPatterns?: Record<string, any>;

  @IsOptional()
  @IsObject()
  behavioralPatterns?: Record<string, any>;

  @IsOptional()
  @IsObject()
  cheatingIndicators?: Record<string, any>;

  @IsOptional()
  @IsObject()
  comparativeMetrics?: Record<string, any>;
}

export class CreateAnswerPatternDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  roundId?: string;

  @IsEnum(PatternType)
  patternType: PatternType;

  @IsOptional()
  @IsEnum(PatternSeverity)
  severity?: PatternSeverity;

  @IsObject()
  patternData: Record<string, any>;

  @IsOptional()
  @IsObject()
  recommendations?: Record<string, any>;

  @IsOptional()
  @IsObject()
  alerts?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidenceScore?: number;
}

export class UpdateAnswerPatternDto {
  @IsOptional()
  @IsEnum(PatternSeverity)
  severity?: PatternSeverity;

  @IsOptional()
  @IsObject()
  patternData?: Record<string, any>;

  @IsOptional()
  @IsObject()
  recommendations?: Record<string, any>;

  @IsOptional()
  @IsObject()
  alerts?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  confidenceScore?: number;
}

export class CreateAnalyticsSessionDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  gameSessionId?: string;

  @IsEnum(SessionType)
  sessionType: SessionType;

  @IsOptional()
  @IsEnum(SessionStatus)
  sessionStatus?: SessionStatus;

  @IsOptional()
  @IsObject()
  sessionMetadata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  performanceMetrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  behavioralMetrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  cheatingIndicators?: Record<string, any>;

  @IsOptional()
  @IsObject()
  learningMetrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  comparativeMetrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  recommendations?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  startedAt?: string;
}

export class UpdateAnalyticsSessionDto {
  @IsOptional()
  @IsEnum(SessionStatus)
  sessionStatus?: SessionStatus;

  @IsOptional()
  @IsObject()
  sessionMetadata?: Record<string, any>;

  @IsOptional()
  @IsObject()
  performanceMetrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  behavioralMetrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  cheatingIndicators?: Record<string, any>;

  @IsOptional()
  @IsObject()
  learningMetrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  comparativeMetrics?: Record<string, any>;

  @IsOptional()
  @IsObject()
  recommendations?: Record<string, any>;

  @IsOptional()
  @IsDateString()
  endedAt?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsBoolean()
  isAnalyzed?: boolean;
}

export class PlayerPerformanceQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsEnum(PerformanceLevel)
  performanceLevel?: PerformanceLevel;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  @IsIn(['id', 'userId', 'sessionId', 'totalRoundsPlayed', 'totalCorrectAnswers', 'totalIncorrectAnswers', 'totalPointsEarned', 'averageResponseTime', 'fastestResponseTime', 'slowestResponseTime', 'accuracyRate', 'averagePointsPerRound', 'performanceLevel', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class AnswerPatternQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsEnum(PatternType)
  patternType?: PatternType;

  @IsOptional()
  @IsEnum(PatternSeverity)
  severity?: PatternSeverity;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  @IsIn(['id', 'userId', 'sessionId', 'roundId', 'patternType', 'severity', 'isActive', 'confidenceScore', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class AnalyticsSessionQueryDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  @IsString()
  gameSessionId?: string;

  @IsOptional()
  @IsEnum(SessionType)
  sessionType?: SessionType;

  @IsOptional()
  @IsEnum(SessionStatus)
  sessionStatus?: SessionStatus;

  @IsOptional()
  @IsBoolean()
  isAnalyzed?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  @IsString()
  @IsIn(['id', 'userId', 'gameSessionId', 'sessionType', 'sessionStatus', 'startedAt', 'endedAt', 'durationMs', 'isAnalyzed', 'analysisCompletedAt', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt';

  @IsOptional()
  @IsString()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export class AnalyticsInsightsDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  difficulties?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  questionTypes?: string[];
}

export class CheatingDetectionDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsString()
  roundId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  riskThreshold?: number = 70;

  @IsOptional()
  @IsBoolean()
  includeDetails?: boolean = true;
}

export class DifficultyAdjustmentDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  questionType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  currentAccuracy?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averageResponseTime?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  recentSessions?: number;
}

export class ImprovementSuggestionsDto {
  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  focusAreas?: string[];

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxSuggestions?: number = 5;

  @IsOptional()
  @IsBoolean()
  includePracticePlan?: boolean = true;
}
