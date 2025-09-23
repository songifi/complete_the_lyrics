import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import { PlayerPerformance, PerformanceLevel } from '../entities/player-performance.entity';
import { AnswerPattern, PatternType, PatternSeverity } from '../entities/answer-pattern.entity';
import { AnalyticsSession, SessionType, SessionStatus } from '../entities/analytics-session.entity';
import { GameRound, QuestionType } from '../../GameRound/entities/game-round.entity';
import { CheatingDetectionService } from './cheating-detection.service';
import { DifficultyAdjustmentService } from './difficulty-adjustment.service';
import { ImprovementSuggestionsService } from './improvement-suggestions.service';
import {
  CreatePlayerPerformanceDto,
  UpdatePlayerPerformanceDto,
  CreateAnswerPatternDto,
  UpdateAnswerPatternDto,
  CreateAnalyticsSessionDto,
  UpdateAnalyticsSessionDto,
  PlayerPerformanceQueryDto,
  AnswerPatternQueryDto,
  AnalyticsSessionQueryDto,
  AnalyticsInsightsDto,
  CheatingDetectionDto,
  DifficultyAdjustmentDto,
  ImprovementSuggestionsDto,
} from '../dto/analytics.dto';

// Security utilities for preventing SQL injection
interface SortValidationResult {
  isValid: boolean;
  column: string;
  direction: 'ASC' | 'DESC';
}

// Whitelist of allowed sortable columns for each entity
const PLAYER_PERFORMANCE_SORTABLE_COLUMNS = {
  'id': 'id',
  'userId': 'userId',
  'sessionId': 'sessionId',
  'totalRoundsPlayed': 'totalRoundsPlayed',
  'totalCorrectAnswers': 'totalCorrectAnswers',
  'totalIncorrectAnswers': 'totalIncorrectAnswers',
  'totalPointsEarned': 'totalPointsEarned',
  'averageResponseTime': 'averageResponseTime',
  'fastestResponseTime': 'fastestResponseTime',
  'slowestResponseTime': 'slowestResponseTime',
  'accuracyRate': 'accuracyRate',
  'averagePointsPerRound': 'averagePointsPerRound',
  'performanceLevel': 'performanceLevel',
  'createdAt': 'createdAt',
  'updatedAt': 'updatedAt',
} as const;

const ANSWER_PATTERN_SORTABLE_COLUMNS = {
  'id': 'id',
  'userId': 'userId',
  'sessionId': 'sessionId',
  'roundId': 'roundId',
  'patternType': 'patternType',
  'severity': 'severity',
  'isActive': 'isActive',
  'confidenceScore': 'confidenceScore',
  'createdAt': 'createdAt',
  'updatedAt': 'updatedAt',
} as const;

const ANALYTICS_SESSION_SORTABLE_COLUMNS = {
  'id': 'id',
  'userId': 'userId',
  'gameSessionId': 'gameSessionId',
  'sessionType': 'sessionType',
  'sessionStatus': 'sessionStatus',
  'startedAt': 'startedAt',
  'endedAt': 'endedAt',
  'durationMs': 'durationMs',
  'isAnalyzed': 'isAnalyzed',
  'analysisCompletedAt': 'analysisCompletedAt',
  'createdAt': 'createdAt',
  'updatedAt': 'updatedAt',
} as const;

@Injectable()
export class AnswerAnalyticsService {
  private readonly logger = new Logger(AnswerAnalyticsService.name);

  constructor(
    @InjectRepository(PlayerPerformance)
    private playerPerformanceRepository: Repository<PlayerPerformance>,
    @InjectRepository(AnswerPattern)
    private answerPatternRepository: Repository<AnswerPattern>,
    @InjectRepository(AnalyticsSession)
    private analyticsSessionRepository: Repository<AnalyticsSession>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    private cheatingDetectionService: CheatingDetectionService,
    private difficultyAdjustmentService: DifficultyAdjustmentService,
    private improvementSuggestionsService: ImprovementSuggestionsService,
  ) {}

  // Security validation methods
  private validateSortParameters(
    sortBy: string | undefined,
    sortOrder: string | undefined,
    allowedColumns: Record<string, string>,
    defaultColumn: string = 'createdAt'
  ): SortValidationResult {
    // Normalize and validate sortBy
    const normalizedSortBy = sortBy?.toLowerCase() || defaultColumn;
    const mappedColumn = allowedColumns[normalizedSortBy];
    
    if (!mappedColumn) {
      this.logger.warn(`Invalid sortBy parameter: ${sortBy}, using default: ${defaultColumn}`);
      return {
        isValid: true,
        column: allowedColumns[defaultColumn] || defaultColumn,
        direction: this.normalizeSortOrder(sortOrder)
      };
    }

    return {
      isValid: true,
      column: mappedColumn,
      direction: this.normalizeSortOrder(sortOrder)
    };
  }

  private normalizeSortOrder(sortOrder: string | undefined): 'ASC' | 'DESC' {
    if (!sortOrder) {
      return 'DESC';
    }
    
    const normalized = sortOrder.toUpperCase();
    if (normalized === 'ASC' || normalized === 'DESC') {
      return normalized;
    }
    
    this.logger.warn(`Invalid sortOrder parameter: ${sortOrder}, using default: DESC`);
    return 'DESC';
  }

  // Player Performance Tracking
  async createPlayerPerformance(dto: CreatePlayerPerformanceDto): Promise<PlayerPerformance> {
    const performance = this.playerPerformanceRepository.create(dto);
    // Persist first to ensure any instance methods that rely on persisted state/ID are safe
    const savedPerformance = await this.playerPerformanceRepository.save(performance);

    // Compute derived fields after initial persistence
    savedPerformance.accuracyRate = savedPerformance.calculateAccuracyRate();
    savedPerformance.averagePointsPerRound = savedPerformance.calculateAveragePointsPerRound();
    savedPerformance.updatePerformanceLevel();

    // Persist again so computed values are stored
    return await this.playerPerformanceRepository.save(savedPerformance);
  }

  async updatePlayerPerformance(
    id: string,
    dto: UpdatePlayerPerformanceDto,
  ): Promise<PlayerPerformance> {
    const performance = await this.playerPerformanceRepository.findOne({ where: { id } });
    if (!performance) {
      throw new Error('Player performance not found');
    }

    Object.assign(performance, dto);
    performance.accuracyRate = performance.calculateAccuracyRate();
    performance.averagePointsPerRound = performance.calculateAveragePointsPerRound();
    performance.updatePerformanceLevel();

    return await this.playerPerformanceRepository.save(performance);
  }

  async getPlayerPerformance(id: string): Promise<PlayerPerformance> {
    const performance = await this.playerPerformanceRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!performance) {
      throw new Error('Player performance not found');
    }
    return performance;
  }

  async getPlayerPerformanceByUserId(userId: string): Promise<PlayerPerformance | null> {
    const performance = await this.playerPerformanceRepository.findOne({
      where: { userId },
      relations: ['user'],
    });
    return performance ?? null;
  }

  async queryPlayerPerformance(query: PlayerPerformanceQueryDto): Promise<{
    data: PlayerPerformance[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryBuilder = this.playerPerformanceRepository.createQueryBuilder('performance');

    if (query.userId) {
      queryBuilder.andWhere('performance.userId = :userId', { userId: query.userId });
    }
    if (query.sessionId) {
      queryBuilder.andWhere('performance.sessionId = :sessionId', { sessionId: query.sessionId });
    }
    if (query.performanceLevel) {
      queryBuilder.andWhere('performance.performanceLevel = :performanceLevel', {
        performanceLevel: query.performanceLevel,
      });
    }
    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('performance.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    }

    // Validate and normalize sort parameters
    const sortValidation = this.validateSortParameters(
      query.sortBy,
      query.sortOrder,
      PLAYER_PERFORMANCE_SORTABLE_COLUMNS
    );

    queryBuilder
      .orderBy(`performance.${sortValidation.column}`, sortValidation.direction)
      .skip(query.offset)
      .take(query.limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  // Answer Pattern Analysis
  async createAnswerPattern(dto: CreateAnswerPatternDto): Promise<AnswerPattern> {
    const pattern = this.answerPatternRepository.create(dto);
    return await this.answerPatternRepository.save(pattern);
  }

  async updateAnswerPattern(id: string, dto: UpdateAnswerPatternDto): Promise<AnswerPattern> {
    const pattern = await this.answerPatternRepository.findOne({ where: { id } });
    if (!pattern) {
      throw new Error('Answer pattern not found');
    }

    Object.assign(pattern, dto);
    return await this.answerPatternRepository.save(pattern);
  }

  async getAnswerPattern(id: string): Promise<AnswerPattern> {
    const pattern = await this.answerPatternRepository.findOne({
      where: { id },
      relations: ['user', 'round'],
    });
    if (!pattern) {
      throw new Error('Answer pattern not found');
    }
    return pattern;
  }

  async queryAnswerPatterns(query: AnswerPatternQueryDto): Promise<{
    data: AnswerPattern[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryBuilder = this.answerPatternRepository.createQueryBuilder('pattern');

    if (query.userId) {
      queryBuilder.andWhere('pattern.userId = :userId', { userId: query.userId });
    }
    if (query.sessionId) {
      queryBuilder.andWhere('pattern.sessionId = :sessionId', { sessionId: query.sessionId });
    }
    if (query.patternType) {
      queryBuilder.andWhere('pattern.patternType = :patternType', {
        patternType: query.patternType,
      });
    }
    if (query.severity) {
      queryBuilder.andWhere('pattern.severity = :severity', { severity: query.severity });
    }
    if (query.isActive !== undefined) {
      queryBuilder.andWhere('pattern.isActive = :isActive', { isActive: query.isActive });
    }
    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('pattern.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    }

    // Validate and normalize sort parameters
    const sortValidation = this.validateSortParameters(
      query.sortBy,
      query.sortOrder,
      ANSWER_PATTERN_SORTABLE_COLUMNS
    );

    queryBuilder
      .orderBy(`pattern.${sortValidation.column}`, sortValidation.direction)
      .skip(query.offset)
      .take(query.limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  // Analytics Session Management
  async createAnalyticsSession(dto: CreateAnalyticsSessionDto): Promise<AnalyticsSession> {
    const session = this.analyticsSessionRepository.create({
      ...dto,
      startedAt: dto.startedAt ? new Date(dto.startedAt) : new Date(),
    });
    return await this.analyticsSessionRepository.save(session);
  }

  async updateAnalyticsSession(
    id: string,
    dto: UpdateAnalyticsSessionDto,
  ): Promise<AnalyticsSession> {
    const session = await this.analyticsSessionRepository.findOne({ where: { id } });
    if (!session) {
      throw new Error('Analytics session not found');
    }

    Object.assign(session, dto);
    if (dto.endedAt) {
      session.endSession();
    }

    return await this.analyticsSessionRepository.save(session);
  }

  async getAnalyticsSession(id: string): Promise<AnalyticsSession> {
    const session = await this.analyticsSessionRepository.findOne({
      where: { id },
      relations: ['user'],
    });
    if (!session) {
      throw new Error('Analytics session not found');
    }
    return session;
  }

  async queryAnalyticsSessions(query: AnalyticsSessionQueryDto): Promise<{
    data: AnalyticsSession[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const queryBuilder = this.analyticsSessionRepository.createQueryBuilder('session');

    if (query.userId) {
      queryBuilder.andWhere('session.userId = :userId', { userId: query.userId });
    }
    if (query.gameSessionId) {
      queryBuilder.andWhere('session.gameSessionId = :gameSessionId', {
        gameSessionId: query.gameSessionId,
      });
    }
    if (query.sessionType) {
      queryBuilder.andWhere('session.sessionType = :sessionType', {
        sessionType: query.sessionType,
      });
    }
    if (query.sessionStatus) {
      queryBuilder.andWhere('session.sessionStatus = :sessionStatus', {
        sessionStatus: query.sessionStatus,
      });
    }
    if (query.isAnalyzed !== undefined) {
      queryBuilder.andWhere('session.isAnalyzed = :isAnalyzed', { isAnalyzed: query.isAnalyzed });
    }
    if (query.startDate && query.endDate) {
      queryBuilder.andWhere('session.createdAt BETWEEN :startDate AND :endDate', {
        startDate: query.startDate,
        endDate: query.endDate,
      });
    }

    // Validate and normalize sort parameters
    const sortValidation = this.validateSortParameters(
      query.sortBy,
      query.sortOrder,
      ANALYTICS_SESSION_SORTABLE_COLUMNS
    );

    queryBuilder
      .orderBy(`session.${sortValidation.column}`, sortValidation.direction)
      .skip(query.offset)
      .take(query.limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  // Advanced Analytics Methods
  async analyzePlayerPerformance(userId: string): Promise<{
    performance: PlayerPerformance;
    patterns: AnswerPattern[];
    insights: any;
    recommendations: any;
  }> {
    const performance = await this.getPlayerPerformanceByUserId(userId);
    const patterns = await this.answerPatternRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    const insights = await this.generatePerformanceInsights(performance, patterns);
    const recommendations = await this.generateRecommendations(performance, patterns);

    return {
      performance,
      patterns,
      insights,
      recommendations,
    };
  }

  async detectCheating(dto: CheatingDetectionDto): Promise<{
    riskScore: number;
    indicators: any[];
    recommendations: string[];
  }> {
    const { userId, sessionId, riskThreshold = 70, includeDetails = true } = dto;

    const analysisResult = await this.cheatingDetectionService.analyzePlayerBehavior(
      userId,
      sessionId,
      24, // 24 hour window
    );

    return {
      riskScore: analysisResult.riskScore,
      indicators: includeDetails ? analysisResult.indicators : [],
      recommendations: analysisResult.recommendations,
    };
  }

  async adjustDifficulty(dto: DifficultyAdjustmentDto): Promise<{
    recommendedDifficulty: string;
    reasoning: string;
    confidence: number;
  }> {
    const { userId, category, questionType } = dto;

    const adjustmentResult = await this.difficultyAdjustmentService.adjustDifficultyForPlayer(
      userId,
      category,
      questionType as QuestionType,
    );

    // Return the first recommendation or a default one
    const recommendation = adjustmentResult.recommendations[0];
    if (recommendation) {
      return {
        recommendedDifficulty: recommendation.recommendedDifficulty,
        reasoning: recommendation.reasoning,
        confidence: recommendation.confidence,
      };
    }

    return {
      recommendedDifficulty: 'medium',
      reasoning: 'No specific difficulty adjustment needed',
      confidence: 50,
    };
  }

  async generateImprovementSuggestions(dto: ImprovementSuggestionsDto): Promise<{
    suggestions: Array<{
      area: string;
      suggestion: string;
      priority: 'low' | 'medium' | 'high';
      expectedImpact: string;
      steps: string[];
    }>;
    practicePlan: any;
  }> {
    const { userId, focusAreas, maxSuggestions = 5, includePracticePlan = true } = dto;

    const suggestions = await this.improvementSuggestionsService.generateSuggestions(
      userId,
      focusAreas,
      maxSuggestions,
    );

    const practicePlan = includePracticePlan
      ? await this.improvementSuggestionsService.generatePracticePlan(userId, suggestions)
      : null;

    // Convert to the expected format
    const formattedSuggestions = suggestions.map(suggestion => ({
      area: suggestion.area,
      suggestion: suggestion.title,
      priority: suggestion.priority === 'critical' ? 'high' : suggestion.priority,
      expectedImpact: `Expected ${suggestion.expectedImpact.improvement}% improvement in ${suggestion.expectedImpact.timeframe}`,
      steps: suggestion.specificSteps.map(step => step.step),
    }));

    return {
      suggestions: formattedSuggestions,
      practicePlan,
    };
  }

  async getComparativeAnalytics(userId: string): Promise<{
    percentileRank: number;
    categoryRankings: Record<string, number>;
    difficultyRankings: Record<string, number>;
    questionTypeRankings: Record<string, number>;
    peerComparison: any;
  }> {
    const performance = await this.getPlayerPerformanceByUserId(userId);
    
    // Get all players' performance for comparison
    const allPerformances = await this.playerPerformanceRepository.find({
      select: ['accuracyRate', 'averageResponseTime', 'averagePointsPerRound', 'categoryPerformance', 'difficultyPerformance', 'questionTypePerformance'],
    });

    const comparativeMetrics = this.calculateComparativeMetrics(performance, allPerformances);

    return comparativeMetrics;
  }

  // Private helper methods
  private async generatePerformanceInsights(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
  ): Promise<any> {
    const insights = {
      strengths: this.identifyStrengths(performance, patterns),
      weaknesses: this.identifyWeaknesses(performance, patterns),
      trends: this.analyzeTrends(performance, patterns),
      learningVelocity: this.calculateLearningVelocity(performance, patterns),
      consistencyScore: this.calculateConsistencyScore(performance, patterns),
    };

    return insights;
  }

  private async generateRecommendations(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
  ): Promise<any> {
    const recommendations = {
      difficultyAdjustments: this.recommendDifficultyAdjustments(performance, patterns),
      practiceSuggestions: this.recommendPracticeAreas(performance, patterns),
      learningStrategies: this.recommendLearningStrategies(performance, patterns),
      nextSteps: this.recommendNextSteps(performance, patterns),
    };

    return recommendations;
  }

  private async analyzeCheatingIndicators(userId: string, rounds: GameRound[]): Promise<any[]> {
    const indicators = [];

    // Analyze response times
    const responseTimes = rounds.map(round => {
      const answers = Object.values(round.answers);
      return answers.map(answer => answer.timeElapsed);
    }).flat();

    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const suspiciouslyFastAnswers = responseTimes.filter(time => time < avgResponseTime * 0.3);

    if (suspiciouslyFastAnswers.length > responseTimes.length * 0.2) {
      indicators.push({
        type: 'suspicious_response_times',
        severity: 'high',
        description: 'Unusually fast response times detected',
        count: suspiciouslyFastAnswers.length,
        percentage: (suspiciouslyFastAnswers.length / responseTimes.length) * 100,
      });
    }

    // Analyze accuracy patterns
    const accuracyRates = rounds.map(round => {
      const answers = Object.values(round.answers);
      const correctAnswers = answers.filter(answer => answer.isCorrect).length;
      return answers.length > 0 ? correctAnswers / answers.length : 0;
    });

    const avgAccuracy = accuracyRates.reduce((a, b) => a + b, 0) / accuracyRates.length;
    const suspiciouslyHighAccuracy = accuracyRates.filter(rate => rate > 0.95);

    if (suspiciouslyHighAccuracy.length > accuracyRates.length * 0.3) {
      indicators.push({
        type: 'suspicious_accuracy',
        severity: 'medium',
        description: 'Unusually high accuracy rates detected',
        count: suspiciouslyHighAccuracy.length,
        percentage: (suspiciouslyHighAccuracy.length / accuracyRates.length) * 100,
      });
    }

    return indicators;
  }

  private calculateCheatingRiskScore(indicators: any[]): number {
    let riskScore = 0;

    indicators.forEach(indicator => {
      switch (indicator.severity) {
        case 'high':
          riskScore += 30;
          break;
        case 'medium':
          riskScore += 20;
          break;
        case 'low':
          riskScore += 10;
          break;
      }
    });

    return Math.min(100, riskScore);
  }

  private generateCheatingPreventionRecommendations(indicators: any[]): string[] {
    const recommendations = [];

    if (indicators.some(i => i.type === 'suspicious_response_times')) {
      recommendations.push('Implement response time validation to prevent automated answers');
    }

    if (indicators.some(i => i.type === 'suspicious_accuracy')) {
      recommendations.push('Add random difficulty spikes to verify genuine knowledge');
    }

    recommendations.push('Implement behavioral analysis to detect non-human patterns');
    recommendations.push('Add CAPTCHA challenges for suspicious sessions');

    return recommendations;
  }

  private calculateDifficultyAdjustment(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    context: any,
  ): { recommendedDifficulty: string; reasoning: string; confidence: number } {
    const { category, questionType, currentAccuracy, averageResponseTime } = context;

    let recommendedDifficulty = 'medium';
    let reasoning = '';
    let confidence = 50;

    if (currentAccuracy > 0.9) {
      recommendedDifficulty = 'hard';
      reasoning = 'High accuracy indicates readiness for harder challenges';
      confidence = 80;
    } else if (currentAccuracy < 0.5) {
      recommendedDifficulty = 'easy';
      reasoning = 'Low accuracy suggests need for easier content';
      confidence = 75;
    } else {
      recommendedDifficulty = 'medium';
      reasoning = 'Current performance suggests appropriate difficulty level';
      confidence = 60;
    }

    return { recommendedDifficulty, reasoning, confidence };
  }

  private generateImprovementSuggestionsFromData(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    options: any,
  ): Array<{
    area: string;
    suggestion: string;
    priority: 'low' | 'medium' | 'high';
    expectedImpact: string;
    steps: string[];
  }> {
    const suggestions = [];

    // Analyze weaknesses
    if (performance.accuracyRate < 0.7) {
      suggestions.push({
        area: 'Accuracy',
        suggestion: 'Focus on improving answer accuracy',
        priority: 'high',
        expectedImpact: 'Increase overall performance by 15-20%',
        steps: [
          'Practice with easier questions first',
          'Take more time to read questions carefully',
          'Review incorrect answers to learn from mistakes',
        ],
      });
    }

    if (performance.averageResponseTime > 20000) {
      suggestions.push({
        area: 'Response Time',
        suggestion: 'Work on faster decision making',
        priority: 'medium',
        expectedImpact: 'Improve efficiency and score more points',
        steps: [
          'Practice with timed exercises',
          'Learn to quickly eliminate wrong answers',
          'Build confidence through repetition',
        ],
      });
    }

    return suggestions.slice(0, options.maxSuggestions);
  }

  private generatePracticePlan(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    suggestions: any[],
  ): any {
    return {
      dailyGoals: {
        roundsToPlay: 10,
        targetAccuracy: Math.min(0.9, performance.accuracyRate + 0.1),
        timeLimit: Math.max(15000, performance.averageResponseTime * 0.8),
      },
      weeklyGoals: {
        focusAreas: suggestions.map(s => s.area),
        practiceSessions: 5,
        improvementTarget: '10% accuracy increase',
      },
      recommendedSchedule: {
        morning: 'Quick 5-round practice',
        evening: 'Focused 15-round session',
        weekend: 'Comprehensive review and new challenges',
      },
    };
  }

  private calculateComparativeMetrics(performance: PlayerPerformance, allPerformances: PlayerPerformance[]): any {
    if (!performance) {
      return {
        percentileRank: 0,
        categoryRankings: {},
        difficultyRankings: {},
        questionTypeRankings: {},
        peerComparison: { betterThan: 0, worseThan: 0, similarTo: 0 },
      };
    }

    const safePerformances = Array.isArray(allPerformances) ? allPerformances : [];
    const nonEmptyPerformances = safePerformances.length > 0 ? safePerformances : [performance];

    const percentileRank = this.calculatePercentileRank(performance, nonEmptyPerformances);

    // Global averages for peer comparison context
    const globalAvg = nonEmptyPerformances.reduce(
      (acc, p) => {
        return {
          accuracyRate: acc.accuracyRate + (p.accuracyRate || 0),
          responseTime: acc.responseTime + (p.averageResponseTime || 0),
          pointsPerRound: acc.pointsPerRound + (p.averagePointsPerRound || 0),
        };
      },
      { accuracyRate: 0, responseTime: 0, pointsPerRound: 0 },
    );
    const count = nonEmptyPerformances.length || 1;
    const globalAverageComparison = {
      accuracyRate: globalAvg.accuracyRate / count,
      responseTime: globalAvg.responseTime / count,
      pointsPerRound: globalAvg.pointsPerRound / count,
    };

    // Helper to compute ranking map for a keyed dimension
    const computeRankings = (
      playerMap: Record<string, { roundsPlayed: number; accuracyRate: number; averageResponseTime: number; pointsEarned: number }>,
      allMaps: Array<Record<string, { roundsPlayed: number; accuracyRate: number; averageResponseTime: number; pointsEarned: number }>>,
    ): Record<string, number> => {
      const rankings: Record<string, number> = {};
      const keys = Object.keys(playerMap || {});
      if (keys.length === 0) return rankings;

      keys.forEach(key => {
        const playerMetric = playerMap[key];
        if (!playerMetric) return;

        const peerScores: number[] = [];
        allMaps.forEach(map => {
          const peerMetric = map?.[key];
          if (!peerMetric) return;
          const score = (peerMetric.accuracyRate || 0) * Math.max(1, peerMetric.roundsPlayed || 0) + (peerMetric.pointsEarned || 0) * 0.001;
          peerScores.push(score);
        });

        const playerScore = (playerMetric.accuracyRate || 0) * Math.max(1, playerMetric.roundsPlayed || 0) + (playerMetric.pointsEarned || 0) * 0.001;

        if (peerScores.length === 0) {
          rankings[key] = 50;
          return;
        }

        const better = peerScores.filter(s => s < playerScore).length;
        rankings[key] = Math.round((better / peerScores.length) * 100);
      });

      return rankings;
    };

    const playerCategory = performance.categoryPerformance || {} as any;
    const playerDifficulty = performance.difficultyPerformance || {} as any;
    const playerQuestionType = performance.questionTypePerformance || {} as any;

    const allCategoryMaps = nonEmptyPerformances.map(p => p.categoryPerformance || {} as any);
    const allDifficultyMaps = nonEmptyPerformances.map(p => p.difficultyPerformance || {} as any);
    const allQuestionTypeMaps = nonEmptyPerformances.map(p => p.questionTypePerformance || {} as any);

    const categoryRankings = computeRankings(playerCategory, allCategoryMaps);
    const difficultyRankings = computeRankings(playerDifficulty, allDifficultyMaps);
    const questionTypeRankings = computeRankings(playerQuestionType, allQuestionTypeMaps);

    // Peer comparison breakdown
    const betterThan = percentileRank;
    const worseThan = Math.max(0, 100 - percentileRank);
    const similarTo = Math.max(0, 100 - betterThan - worseThan);

    return {
      percentileRank,
      categoryRankings,
      difficultyRankings,
      questionTypeRankings,
      peerComparison: {
        percentileRank,
        betterThan,
        worseThan,
        similarTo,
        globalAverageComparison,
      },
    };
  }

  private calculatePercentileRank(performance: PlayerPerformance, allPerformances: PlayerPerformance[]): number {
    const scores = allPerformances.map(p => p.accuracyRate * p.averagePointsPerRound);
    const playerScore = performance.accuracyRate * performance.averagePointsPerRound;
    
    const betterScores = scores.filter(score => score < playerScore).length;
    return Math.round((betterScores / scores.length) * 100);
  }

  // Additional helper methods for pattern analysis
  private identifyStrengths(performance: PlayerPerformance, patterns: AnswerPattern[]): string[] {
    const strengths = [];
    
    if (performance.accuracyRate > 0.8) {
      strengths.push('High accuracy');
    }
    if (performance.averageResponseTime < 10000) {
      strengths.push('Quick response time');
    }
    if (performance.performanceLevel === PerformanceLevel.EXPERT) {
      strengths.push('Expert level performance');
    }
    
    return strengths;
  }

  private identifyWeaknesses(performance: PlayerPerformance, patterns: AnswerPattern[]): string[] {
    const weaknesses = [];
    
    if (performance.accuracyRate < 0.6) {
      weaknesses.push('Low accuracy');
    }
    if (performance.averageResponseTime > 25000) {
      weaknesses.push('Slow response time');
    }
    if (performance.performanceLevel === PerformanceLevel.BEGINNER) {
      weaknesses.push('Needs skill development');
    }
    
    return weaknesses;
  }

  private analyzeTrends(performance: PlayerPerformance, patterns: AnswerPattern[]): any {
    return {
      accuracyTrend: 'stable',
      responseTimeTrend: 'improving',
      pointsTrend: 'increasing',
    };
  }

  private calculateLearningVelocity(performance: PlayerPerformance, patterns: AnswerPattern[]): number {
    // Simplified calculation - in real implementation, this would analyze historical data
    return 0.1; // 10% improvement per week
  }

  private calculateConsistencyScore(performance: PlayerPerformance, patterns: AnswerPattern[]): number {
    // Simplified calculation - in real implementation, this would analyze variance
    return 75; // 75% consistency
  }

  private recommendDifficultyAdjustments(performance: PlayerPerformance, patterns: AnswerPattern[]): any[] {
    return [];
  }

  private recommendPracticeAreas(performance: PlayerPerformance, patterns: AnswerPattern[]): any[] {
    return [];
  }

  private recommendLearningStrategies(performance: PlayerPerformance, patterns: AnswerPattern[]): any[] {
    return [];
  }

  private recommendNextSteps(performance: PlayerPerformance, patterns: AnswerPattern[]): any[] {
    return [];
  }
}
