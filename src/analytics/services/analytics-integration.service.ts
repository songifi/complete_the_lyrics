import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound, QuestionType } from '../../GameRound/entities/game-round.entity';
import { GameSession } from '../../GameRound/entities/game-session.entity';
import { AnswerAnalyticsService } from './answer-analytics.service';
import { CheatingDetectionService } from './cheating-detection.service';
import { DifficultyAdjustmentService } from './difficulty-adjustment.service';
import { ImprovementSuggestionsService } from './improvement-suggestions.service';
import { PlayerPerformance, PerformanceLevel } from '../entities/player-performance.entity';
import { AnswerPattern, PatternType } from '../entities/answer-pattern.entity';
import { AnalyticsSession, SessionType, SessionStatus } from '../entities/analytics-session.entity';

const RISK_SCORE_THRESHOLD = 70; // Cheating alert threshold

// Strongly typed payloads for analytics updates
export interface PatternData {
  id?: string;
  name?: string;
  metrics?: Record<string, number | string>;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export type CheatingIndicator = Array<{
  type: string;
  description?: string;
  confidence?: number;
  details?: Record<string, unknown>;
}>;

// Concrete types for event payloads
export interface DeviceInfo {
  userAgent?: string;
  platform?: string;
  deviceType?: 'mobile' | 'desktop' | 'tablet' | string;
  os?: string;
  appVersion?: string;
}

export interface NetworkInfo {
  ip?: string;
  connectionType?: 'wifi' | 'cellular' | 'ethernet' | 'unknown' | string;
  rttMs?: number;
  downlinkKbps?: number;
}

export interface GameSettings {
  difficulty?: string;
  category?: string;
  questionType?: QuestionType;
  [key: string]: unknown;
}

export type SubmittedAnswer = string | number | Record<string, unknown>;

export interface SessionStartedEvent {
  type: 'session_started';
  userId: string;
  sessionId: string;
  data: {
    deviceInfo?: DeviceInfo;
    networkInfo?: NetworkInfo;
    gameSettings?: GameSettings;
  };
  timestamp: Date;
}

export interface SessionEndedEvent {
  type: 'session_ended';
  userId: string;
  sessionId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface RoundStartedEvent {
  type: 'round_started';
  userId: string;
  sessionId: string;
  roundId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface RoundEndedEvent {
  type: 'round_ended';
  userId: string;
  sessionId: string;
  roundId: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface AnswerSubmittedEvent {
  type: 'answer_submitted';
  userId: string;
  sessionId: string;
  roundId?: string;
  data: {
    answer: SubmittedAnswer;
    timeElapsed: number;
    isCorrect: boolean;
  };
  timestamp: Date;
}

export type GameEvent =
  | SessionStartedEvent
  | SessionEndedEvent
  | RoundStartedEvent
  | RoundEndedEvent
  | AnswerSubmittedEvent;

export interface AnalyticsUpdate {
  performanceUpdate?: Partial<PlayerPerformance>;
  patternUpdate?: {
    type: PatternType;
    data: PatternData;
    severity?: 'low' | 'medium' | 'high' | 'critical';
  };
  sessionUpdate?: Partial<AnalyticsSession>;
  cheatingAlert?: {
    riskScore: number;
    indicators: CheatingIndicator;
  };
  difficultyRecommendation?: {
    category: string;
    questionType: QuestionType;
    recommendedDifficulty: string;
    confidence: number;
  };
}

@Injectable()
export class AnalyticsIntegrationService {
  private readonly logger = new Logger(AnalyticsIntegrationService.name);

  constructor(
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    @InjectRepository(GameSession)
    private gameSessionRepository: Repository<GameSession>,
    private answerAnalyticsService: AnswerAnalyticsService,
    private cheatingDetectionService: CheatingDetectionService,
    private difficultyAdjustmentService: DifficultyAdjustmentService,
    private improvementSuggestionsService: ImprovementSuggestionsService,
  ) {}

  async processGameEvent(event: GameEvent): Promise<AnalyticsUpdate[]> {
    const updates: AnalyticsUpdate[] = [];

    try {
      switch (event.type) {
        case 'session_started':
          updates.push(...await this.handleSessionStarted(event as SessionStartedEvent));
          break;
        case 'session_ended':
          updates.push(...await this.handleSessionEnded(event as SessionEndedEvent));
          break;
        case 'round_started':
          updates.push(...await this.handleRoundStarted(event as RoundStartedEvent));
          break;
        case 'round_ended':
          updates.push(...await this.handleRoundEnded(event as RoundEndedEvent));
          break;
        case 'answer_submitted':
          updates.push(...await this.handleAnswerSubmitted(event as AnswerSubmittedEvent));
          break;
      }
    } catch (error) {
      this.logger.error(`Error processing game event: ${error.message}`, error.stack);
    }

    return updates;
  }

  private async handleSessionStarted(event: Extract<GameEvent, { type: 'session_started' }>): Promise<AnalyticsUpdate[]> {
    const updates: AnalyticsUpdate[] = [];

    // Create analytics session
    const session = await this.answerAnalyticsService.createAnalyticsSession({
      userId: event.userId,
      gameSessionId: event.sessionId,
      sessionType: SessionType.GAME_SESSION,
      sessionMetadata: {
        deviceInfo: event.data.deviceInfo,
        networkInfo: event.data.networkInfo,
        gameSettings: event.data.gameSettings,
      },
    });

    updates.push({
      sessionUpdate: {
        id: session.id,
        sessionStatus: SessionStatus.ACTIVE,
      },
    });

    return updates;
  }

  private async handleSessionEnded(event: Extract<GameEvent, { type: 'session_ended' }>): Promise<AnalyticsUpdate[]> {
    const updates: AnalyticsUpdate[] = [];

    // Get session data
    const session = await this.gameSessionRepository.findOne({
      where: { id: event.sessionId },
      relations: ['rounds'],
    });

    if (!session) {
      return updates;
    }

    // Calculate session performance
    const performanceData = this.calculateSessionPerformance(session);
    
    // Update player performance
    const performance = await this.getOrCreatePlayerPerformance(event.userId);
    this.updatePlayerPerformanceFromSession(performance, performanceData);

    updates.push({
      performanceUpdate: performance,
    });

    // Check for cheating
    const cheatingAnalysis = await this.cheatingDetectionService.analyzePlayerBehavior(
      event.userId,
      event.sessionId,
    );

    if (cheatingAnalysis.riskScore > RISK_SCORE_THRESHOLD) {
      updates.push({
        cheatingAlert: {
          riskScore: cheatingAnalysis.riskScore,
          indicators: cheatingAnalysis.indicators,
        },
      });
    }

    // Generate difficulty recommendations
    const difficultyRecommendations = await this.difficultyAdjustmentService.adjustDifficultyForPlayer(
      event.userId,
    );

    if (difficultyRecommendations.recommendations.length > 0) {
      const recommendation = difficultyRecommendations.recommendations[0];
      updates.push({
        difficultyRecommendation: {
          category: recommendation.category,
          questionType: recommendation.questionType,
          recommendedDifficulty: recommendation.recommendedDifficulty,
          confidence: recommendation.confidence,
        },
      });
    }

    return updates;
  }

  private async handleRoundStarted(event: Extract<GameEvent, { type: 'round_started' }>): Promise<AnalyticsUpdate[]> {
    const updates: AnalyticsUpdate[] = [];

    // Get round data
    const round = await this.gameRoundRepository.findOne({
      where: { id: event.roundId },
    });

    if (!round) {
      return updates;
    }

    // Analyze question difficulty and player readiness
    const performance = await this.getOrCreatePlayerPerformance(event.userId);
    const category = round?.metadata?.songInfo?.genre ?? 'general';
    const categoryPerformance = performance?.categoryPerformance?.[category] ?? null;
    const questionType = round?.questionType ?? null;
    const questionTypePerformance = questionType != null
      ? (performance?.questionTypePerformance?.[questionType] ?? null)
      : null;

    // Check if difficulty adjustment is needed
    if ((categoryPerformance?.accuracyRate ?? null) != null && categoryPerformance.accuracyRate < 0.5) {
      updates.push({
        patternUpdate: {
          type: PatternType.DIFFICULTY_PREFERENCE,
          data: {
            category,
            questionType: questionType ?? 'unknown',
            currentDifficulty: 'too_hard',
            playerAccuracy: categoryPerformance.accuracyRate,
          },
          severity: 'medium',
        },
      });
    }

    return updates;
  }

  private async handleRoundEnded(event: Extract<GameEvent, { type: 'round_ended' }>): Promise<AnalyticsUpdate[]> {
    const updates: AnalyticsUpdate[] = [];

    // Get round data
    const round = await this.gameRoundRepository.findOne({
      where: { id: event.roundId },
    });

    if (!round) {
      return updates;
    }

    // Update player performance
    const performance = await this.getOrCreatePlayerPerformance(event.userId);
    this.updatePlayerPerformanceFromRound(performance, round);

    updates.push({
      performanceUpdate: performance,
    });

    // Analyze answer patterns
    const answerPatterns = this.analyzeAnswerPatterns(round, event.userId);
    
    for (const pattern of answerPatterns) {
      updates.push({
        patternUpdate: pattern,
      });
    }

    // Check for cheating indicators
    const cheatingAnalysis = await this.cheatingDetectionService.analyzePlayerBehavior(
      event.userId,
      event.sessionId,
      1, // 1 hour window
    );

    if (cheatingAnalysis.riskScore > 60) {
      updates.push({
        cheatingAlert: {
          riskScore: cheatingAnalysis.riskScore,
          indicators: cheatingAnalysis.indicators,
        },
      });
    }

    return updates;
  }

  private async handleAnswerSubmitted(event: Extract<GameEvent, { type: 'answer_submitted' }>): Promise<AnalyticsUpdate[]> {
    const updates: AnalyticsUpdate[] = [];

    const { answer, timeElapsed, isCorrect } = event.data;

    // Analyze response time patterns
    if (timeElapsed < 1000) { // Suspiciously fast
      updates.push({
        patternUpdate: {
          type: PatternType.CHEATING_SUSPICION,
          data: {
            responseTime: timeElapsed,
            expectedTime: 5000, // Expected minimum time
            suspicionScore: 80,
          },
          severity: 'high',
        },
      });
    }

    // Analyze accuracy patterns
    if (isCorrect && timeElapsed < 2000) { // Very fast correct answer
      updates.push({
        patternUpdate: {
          type: PatternType.ACCURACY,
          data: {
            accuracy: 1.0,
            responseTime: timeElapsed,
            pattern: 'very_fast_correct',
          },
          severity: 'medium',
        },
      });
    }

    return updates;
  }

  private async getOrCreatePlayerPerformance(userId: string): Promise<PlayerPerformance> {
    const existing = await this.answerAnalyticsService.getPlayerPerformanceByUserId(userId);
    if (existing) {
      return existing;
    }
    // Create new performance record when none exists
    return await this.answerAnalyticsService.createPlayerPerformance({
      userId,
      totalRoundsPlayed: 0,
      totalCorrectAnswers: 0,
      totalIncorrectAnswers: 0,
      totalPointsEarned: 0,
      averageResponseTime: 0,
      performanceLevel: PerformanceLevel.BEGINNER,
    });
  }

  private calculateSessionPerformance(session: GameSession): any {
    const rounds = session.rounds || [];
    let totalRounds = 0;
    let totalCorrect = 0;
    let totalPoints = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    rounds.forEach(round => {
      const answers = Object.values(round.answers);
      totalRounds += answers.length;
      
      answers.forEach(answer => {
        if (answer.isCorrect) totalCorrect++;
        totalPoints += answer.pointsAwarded;
        totalResponseTime += answer.timeElapsed;
        responseCount++;
      });
    });

    return {
      totalRounds,
      totalCorrect,
      totalPoints,
      averageResponseTime: responseCount > 0 ? totalResponseTime / responseCount : 0,
      accuracyRate: totalRounds > 0 ? totalCorrect / totalRounds : 0,
    };
  }

  private updatePlayerPerformanceFromSession(performance: PlayerPerformance, sessionData: any): void {
    performance.totalRoundsPlayed += sessionData.totalRounds;
    performance.totalCorrectAnswers += sessionData.totalCorrect;
    performance.totalPointsEarned += sessionData.totalPoints;
    
    // Update average response time
    const totalResponses = performance.totalRoundsPlayed;
    const currentAvg = performance.averageResponseTime;
    const newAvg = sessionData.averageResponseTime;
    
    performance.averageResponseTime = totalResponses > 0 
      ? ((currentAvg * (totalResponses - sessionData.totalRounds)) + (newAvg * sessionData.totalRounds)) / totalResponses
      : newAvg;

    performance.accuracyRate = performance.calculateAccuracyRate();
    performance.averagePointsPerRound = performance.calculateAveragePointsPerRound();
    performance.updatePerformanceLevel();
  }

  private updatePlayerPerformanceFromRound(performance: PlayerPerformance, round: GameRound): void {
    const answers = Object.values(round.answers);
    const correctAnswers = answers.filter(answer => answer.isCorrect).length;
    const totalPoints = answers.reduce((sum, answer) => sum + answer.pointsAwarded, 0);
    const avgResponseTime = answers.reduce((sum, answer) => sum + answer.timeElapsed, 0) / answers.length;

    performance.totalRoundsPlayed += answers.length;
    performance.totalCorrectAnswers += correctAnswers;
    performance.totalIncorrectAnswers += answers.length - correctAnswers;
    performance.totalPointsEarned += totalPoints;

    // Update category performance
    const category = round.metadata?.songInfo?.genre || 'general';
    if (!performance.categoryPerformance[category]) {
      performance.categoryPerformance[category] = {
        roundsPlayed: 0,
        correctAnswers: 0,
        accuracyRate: 0,
        averageResponseTime: 0,
        pointsEarned: 0,
      };
    }

    const categoryPerf = performance.categoryPerformance[category];
    categoryPerf.roundsPlayed += answers.length;
    categoryPerf.correctAnswers += correctAnswers;
    categoryPerf.accuracyRate = categoryPerf.correctAnswers / categoryPerf.roundsPlayed;
    categoryPerf.pointsEarned += totalPoints;

    // Update question type performance
    const questionType = round.questionType;
    if (!performance.questionTypePerformance[questionType]) {
      performance.questionTypePerformance[questionType] = {
        roundsPlayed: 0,
        correctAnswers: 0,
        accuracyRate: 0,
        averageResponseTime: 0,
        pointsEarned: 0,
      };
    }

    const questionTypePerf = performance.questionTypePerformance[questionType];
    questionTypePerf.roundsPlayed += answers.length;
    questionTypePerf.correctAnswers += correctAnswers;
    questionTypePerf.accuracyRate = questionTypePerf.correctAnswers / questionTypePerf.roundsPlayed;
    questionTypePerf.pointsEarned += totalPoints;

    performance.accuracyRate = performance.calculateAccuracyRate();
    performance.averagePointsPerRound = performance.calculateAveragePointsPerRound();
    performance.updatePerformanceLevel();
  }

  private analyzeAnswerPatterns(round: GameRound, userId: string): Array<{
    type: PatternType;
    data: any;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> {
    const patterns = [];
    const answers = Object.values(round.answers);

    if (answers.length === 0) return patterns;

    // Analyze response time patterns
    const responseTimes = answers.map(answer => answer.timeElapsed);
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);

    // Check for suspiciously fast responses
    if (minResponseTime < 500) {
      patterns.push({
        type: PatternType.CHEATING_SUSPICION,
        data: {
          responseTime: minResponseTime,
          expectedTime: 2000,
          suspicionScore: 90,
        },
        severity: 'critical',
      });
    }

    // Check for consistency in response times
    const variance = responseTimes.reduce((sum, time) => sum + Math.pow(time - avgResponseTime, 2), 0) / responseTimes.length;
    const coefficientOfVariation = Math.sqrt(variance) / avgResponseTime;

    if (coefficientOfVariation < 0.1 && responseTimes.length > 3) {
      patterns.push({
        type: PatternType.CONSISTENCY,
        data: {
          coefficientOfVariation,
          averageTime: avgResponseTime,
          consistencyScore: 95,
        },
        severity: 'medium',
      });
    }

    // Analyze accuracy patterns
    const correctAnswers = answers.filter(answer => answer.isCorrect).length;
    const accuracyRate = correctAnswers / answers.length;

    if (accuracyRate === 1.0 && avgResponseTime < 5000) {
      patterns.push({
        type: PatternType.ACCURACY,
        data: {
          accuracyRate,
          responseTime: avgResponseTime,
          pattern: 'perfect_fast',
        },
        severity: 'high',
      });
    }

    return patterns;
  }

  // Public methods for external integration
  async getPlayerInsights(userId: string): Promise<any> {
    return await this.answerAnalyticsService.analyzePlayerPerformance(userId);
  }

  async getCheatingAnalysis(userId: string, sessionId?: string): Promise<any> {
    return await this.cheatingDetectionService.analyzePlayerBehavior(userId, sessionId);
  }

  async getDifficultyRecommendations(userId: string, category?: string, questionType?: QuestionType): Promise<any> {
    return await this.difficultyAdjustmentService.adjustDifficultyForPlayer(userId, category, questionType);
  }

  async getImprovementSuggestions(userId: string, focusAreas?: string[]): Promise<any> {
    return await this.improvementSuggestionsService.generateSuggestions(userId, focusAreas);
  }

  async getPracticePlan(userId: string): Promise<any> {
    const suggestions = await this.improvementSuggestionsService.generateSuggestions(userId);
    return await this.improvementSuggestionsService.generatePracticePlan(userId, suggestions);
  }

  async getLearningPath(userId: string): Promise<any> {
    return await this.improvementSuggestionsService.generateLearningPath(userId);
  }
}
