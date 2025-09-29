import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerPerformance } from '../entities/player-performance.entity';
import { AnswerPattern } from '../entities/answer-pattern.entity';
import { GameRound, QuestionType } from '../../GameRound/entities/game-round.entity';

export interface DifficultyRecommendation {
  category: string;
  questionType: QuestionType;
  currentDifficulty: string;
  recommendedDifficulty: string;
  confidence: number;
  reasoning: string;
  expectedImpact: string;
  adjustmentFactors: {
    accuracyRate: number;
    responseTime: number;
    consistency: number;
    recentTrend: 'improving' | 'declining' | 'stable';
    playerLevel: string;
  };
}

export interface DifficultyAdjustmentResult {
  recommendations: DifficultyRecommendation[];
  overallAdjustment: {
    direction: 'increase' | 'decrease' | 'maintain';
    magnitude: 'small' | 'medium' | 'large';
    confidence: number;
  };
  personalizedSettings: {
    timeLimitAdjustment: number;
    hintFrequency: number;
    questionComplexity: number;
  };
}

@Injectable()
export class DifficultyAdjustmentService {
  private readonly logger = new Logger(DifficultyAdjustmentService.name);

  private readonly DIFFICULTY_LEVELS = ['easy', 'medium', 'hard', 'expert'];
  private readonly DIFFICULTY_THRESHOLDS = {
    easy: { minAccuracy: 0.0, maxAccuracy: 0.6, maxResponseTime: 30000 },
    medium: { minAccuracy: 0.6, maxAccuracy: 0.8, maxResponseTime: 25000 },
    hard: { minAccuracy: 0.8, maxAccuracy: 0.9, maxResponseTime: 20000 },
    expert: { minAccuracy: 0.9, maxAccuracy: 1.0, maxResponseTime: 15000 },
  };

  constructor(
    @InjectRepository(PlayerPerformance)
    private playerPerformanceRepository: Repository<PlayerPerformance>,
    @InjectRepository(AnswerPattern)
    private answerPatternRepository: Repository<AnswerPattern>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
  ) {}

  async adjustDifficultyForPlayer(
    userId: string,
    category?: string,
    questionType?: QuestionType,
  ): Promise<DifficultyAdjustmentResult> {
    const performance = await this.playerPerformanceRepository.findOne({
      where: { userId },
    });

    if (!performance) {
      throw new Error('Player performance data not found');
    }

    // Get recent performance patterns
    const recentPatterns = await this.answerPatternRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
      take: 20,
    });

    // Get recent game rounds for trend analysis
    const recentRounds = await this.gameRoundRepository.find({
      where: { sessionId: performance.sessionId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const recommendations: DifficultyRecommendation[] = [];

    // Analyze different categories and question types
    const categories = category ? [category] : this.getAvailableCategories(performance);
    const questionTypes = questionType ? [questionType] : Object.values(QuestionType);

    for (const cat of categories) {
      for (const qType of questionTypes) {
        const recommendation = await this.analyzeCategoryDifficulty(
          performance,
          recentPatterns,
          recentRounds,
          cat,
          qType,
        );
        
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    }

    // Calculate overall adjustment
    const overallAdjustment = this.calculateOverallAdjustment(recommendations);
    
    // Generate personalized settings
    const personalizedSettings = this.generatePersonalizedSettings(
      performance,
      recentPatterns,
      recommendations,
    );

    return {
      recommendations,
      overallAdjustment,
      personalizedSettings,
    };
  }

  private async analyzeCategoryDifficulty(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    rounds: GameRound[],
    category: string,
    questionType: QuestionType,
  ): Promise<DifficultyRecommendation | null> {
    // Get current performance for this category and question type
    const categoryPerf = performance.categoryPerformance[category] || {
      roundsPlayed: 0,
      correctAnswers: 0,
      accuracyRate: 0,
      averageResponseTime: 0,
      pointsEarned: 0,
    };

    const questionTypePerf = performance.questionTypePerformance[questionType] || {
      roundsPlayed: 0,
      correctAnswers: 0,
      accuracyRate: 0,
      averageResponseTime: 0,
      pointsEarned: 0,
    };

    // Calculate combined metrics
    const accuracyRate = (categoryPerf.accuracyRate + questionTypePerf.accuracyRate) / 2;
    const responseTime = (categoryPerf.averageResponseTime + questionTypePerf.averageResponseTime) / 2;
    const consistency = this.calculateConsistency(patterns, category, questionType);
    const recentTrend = this.analyzeRecentTrend(rounds, category, questionType);

    // Determine current difficulty level
    const currentDifficulty = this.determineCurrentDifficulty(accuracyRate, responseTime);
    
    // Calculate recommended difficulty
    const recommendedDifficulty = this.calculateRecommendedDifficulty(
      accuracyRate,
      responseTime,
      consistency,
      recentTrend,
      performance.performanceLevel,
    );

    // Skip if no adjustment needed
    if (currentDifficulty === recommendedDifficulty) {
      return null;
    }

    const confidence = this.calculateConfidence(
      accuracyRate,
      responseTime,
      consistency,
      categoryPerf.roundsPlayed + questionTypePerf.roundsPlayed,
    );

    const reasoning = this.generateReasoning(
      accuracyRate,
      responseTime,
      consistency,
      recentTrend,
      currentDifficulty,
      recommendedDifficulty,
    );

    const expectedImpact = this.predictImpact(
      currentDifficulty,
      recommendedDifficulty,
      accuracyRate,
      responseTime,
    );

    return {
      category,
      questionType,
      currentDifficulty,
      recommendedDifficulty,
      confidence,
      reasoning,
      expectedImpact,
      adjustmentFactors: {
        accuracyRate,
        responseTime,
        consistency,
        recentTrend,
        playerLevel: performance.performanceLevel,
      },
    };
  }

  private getAvailableCategories(performance: PlayerPerformance): string[] {
    return Object.keys(performance.categoryPerformance).length > 0
      ? Object.keys(performance.categoryPerformance)
      : ['general', 'pop', 'rock', 'hip-hop', 'classical', 'jazz'];
  }

  private determineCurrentDifficulty(accuracyRate: number, responseTime: number): string {
    for (const [level, thresholds] of Object.entries(this.DIFFICULTY_THRESHOLDS)) {
      const isTopLevel = level === 'expert';
      const withinAccuracy =
        accuracyRate >= thresholds.minAccuracy &&
        (isTopLevel ? accuracyRate <= thresholds.maxAccuracy : accuracyRate < thresholds.maxAccuracy);

      if (withinAccuracy && responseTime <= thresholds.maxResponseTime) {
        return level;
      }
    }
    return 'medium'; // Default fallback
  }

  private calculateRecommendedDifficulty(
    accuracyRate: number,
    responseTime: number,
    consistency: number,
    trend: 'improving' | 'declining' | 'stable',
    playerLevel: string,
  ): string {
    let recommendedLevel = 'medium';

    // High accuracy and fast response = increase difficulty
    if (accuracyRate > 0.85 && responseTime < 15000) {
      recommendedLevel = this.increaseDifficulty(playerLevel);
    }
    // Low accuracy or slow response = decrease difficulty
    else if (accuracyRate < 0.6 || responseTime > 25000) {
      recommendedLevel = this.decreaseDifficulty(playerLevel);
    }
    // Consider trend
    else if (trend === 'improving' && accuracyRate > 0.7) {
      recommendedLevel = this.increaseDifficulty(playerLevel);
    }
    else if (trend === 'declining' && accuracyRate < 0.7) {
      recommendedLevel = this.decreaseDifficulty(playerLevel);
    }
    // Consider consistency
    else if (consistency > 0.8 && accuracyRate > 0.75) {
      recommendedLevel = this.increaseDifficulty(playerLevel);
    }
    else if (consistency < 0.5) {
      recommendedLevel = this.decreaseDifficulty(playerLevel);
    }

    return recommendedLevel;
  }

  private increaseDifficulty(currentLevel: string): string {
    const currentIndex = this.DIFFICULTY_LEVELS.indexOf(currentLevel);
    return this.DIFFICULTY_LEVELS[Math.min(currentIndex + 1, this.DIFFICULTY_LEVELS.length - 1)];
  }

  private decreaseDifficulty(currentLevel: string): string {
    const currentIndex = this.DIFFICULTY_LEVELS.indexOf(currentLevel);
    return this.DIFFICULTY_LEVELS[Math.max(currentIndex - 1, 0)];
  }

  private calculateConsistency(
    patterns: AnswerPattern[],
    category: string,
    questionType: QuestionType,
  ): number {
    const relevantPatterns = patterns.filter(pattern => 
      pattern.patternType === 'consistency' &&
      pattern.patternData?.consistencyData?.consistencyScore !== undefined
    );

    if (relevantPatterns.length === 0) return 0.5; // Default moderate consistency

    const consistencyScores = relevantPatterns.map(pattern => 
      pattern.patternData?.consistencyData?.consistencyScore || 0
    );

    return consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length;
  }

  private analyzeRecentTrend(
    rounds: GameRound[],
    category: string,
    questionType: QuestionType,
  ): 'improving' | 'declining' | 'stable' {
    if (rounds.length < 5) return 'stable';

    const recentRounds = rounds.slice(0, 5);
    const olderRounds = rounds.slice(5, 10);

    if (olderRounds.length === 0) return 'stable';

    const recentAccuracy = this.calculateAccuracyForRounds(recentRounds, category, questionType);
    const olderAccuracy = this.calculateAccuracyForRounds(olderRounds, category, questionType);

    const improvement = recentAccuracy - olderAccuracy;

    if (improvement > 0.1) return 'improving';
    if (improvement < -0.1) return 'declining';
    return 'stable';
  }

  private calculateAccuracyForRounds(
    rounds: GameRound[],
    category: string,
    questionType: QuestionType,
  ): number {
    let totalAnswers = 0;
    let correctAnswers = 0;

    rounds.forEach(round => {
      if (round.questionType === questionType) {
        const answers = Object.values(round.answers);
        totalAnswers += answers.length;
        correctAnswers += answers.filter(answer => answer.isCorrect).length;
      }
    });

    return totalAnswers > 0 ? correctAnswers / totalAnswers : 0;
  }

  private calculateConfidence(
    accuracyRate: number,
    responseTime: number,
    consistency: number,
    dataPoints: number,
  ): number {
    let confidence = 50; // Base confidence

    // More data points = higher confidence
    confidence += Math.min(30, dataPoints * 2);

    // High consistency = higher confidence
    confidence += consistency * 20;

    // Clear performance indicators = higher confidence
    if (accuracyRate > 0.9 || accuracyRate < 0.4) {
      confidence += 15;
    }

    if (responseTime < 10000 || responseTime > 30000) {
      confidence += 10;
    }

    return Math.min(95, Math.max(20, confidence));
  }

  private generateReasoning(
    accuracyRate: number,
    responseTime: number,
    consistency: number,
    trend: string,
    currentDifficulty: string,
    recommendedDifficulty: string,
  ): string {
    const reasons = [];

    if (accuracyRate > 0.85) {
      reasons.push(`High accuracy rate of ${(accuracyRate * 100).toFixed(1)}%`);
    } else if (accuracyRate < 0.6) {
      reasons.push(`Low accuracy rate of ${(accuracyRate * 100).toFixed(1)}%`);
    }

    if (responseTime < 15000) {
      reasons.push(`Fast response time of ${(responseTime / 1000).toFixed(1)}s`);
    } else if (responseTime > 25000) {
      reasons.push(`Slow response time of ${(responseTime / 1000).toFixed(1)}s`);
    }

    if (consistency > 0.8) {
      reasons.push('High consistency in performance');
    } else if (consistency < 0.5) {
      reasons.push('Low consistency in performance');
    }

    if (trend === 'improving') {
      reasons.push('Improving performance trend');
    } else if (trend === 'declining') {
      reasons.push('Declining performance trend');
    }

    const direction = this.getDifficultyDirection(currentDifficulty, recommendedDifficulty);
    return `Recommended ${direction} difficulty based on: ${reasons.join(', ')}`;
  }

  private getDifficultyDirection(current: string, recommended: string): string {
    const currentIndex = this.DIFFICULTY_LEVELS.indexOf(current);
    const recommendedIndex = this.DIFFICULTY_LEVELS.indexOf(recommended);

    if (recommendedIndex > currentIndex) return 'increase';
    if (recommendedIndex < currentIndex) return 'decrease';
    return 'maintain';
  }

  private predictImpact(
    currentDifficulty: string,
    recommendedDifficulty: string,
    currentAccuracy: number,
    currentResponseTime: number,
  ): string {
    const direction = this.getDifficultyDirection(currentDifficulty, recommendedDifficulty);

    switch (direction) {
      case 'increase':
        return `Expected to challenge player more, potentially reducing accuracy by 5-10% but improving learning`;
      case 'decrease':
        return `Expected to improve player confidence and accuracy by 10-15%`;
      case 'maintain':
        return `Current difficulty appears appropriate for player's skill level`;
      default:
        return 'Difficulty adjustment impact unclear';
    }
  }

  private calculateOverallAdjustment(recommendations: DifficultyRecommendation[]): {
    direction: 'increase' | 'decrease' | 'maintain';
    magnitude: 'small' | 'medium' | 'large';
    confidence: number;
  } {
    if (recommendations.length === 0) {
      return {
        direction: 'maintain',
        magnitude: 'small',
        confidence: 50,
      };
    }

    const increaseCount = recommendations.filter(r => 
      this.getDifficultyDirection(r.currentDifficulty, r.recommendedDifficulty) === 'increase'
    ).length;
    
    const decreaseCount = recommendations.filter(r => 
      this.getDifficultyDirection(r.currentDifficulty, r.recommendedDifficulty) === 'decrease'
    ).length;

    const totalCount = recommendations.length;
    const avgConfidence = recommendations.reduce((sum, r) => sum + r.confidence, 0) / totalCount;

    let direction: 'increase' | 'decrease' | 'maintain';
    if (increaseCount > decreaseCount) {
      direction = 'increase';
    } else if (decreaseCount > increaseCount) {
      direction = 'decrease';
    } else {
      direction = 'maintain';
    }

    const adjustmentRatio = Math.max(increaseCount, decreaseCount) / totalCount;
    let magnitude: 'small' | 'medium' | 'large';
    if (adjustmentRatio > 0.7) {
      magnitude = 'large';
    } else if (adjustmentRatio > 0.4) {
      magnitude = 'medium';
    } else {
      magnitude = 'small';
    }

    return {
      direction,
      magnitude,
      confidence: Math.round(avgConfidence),
    };
  }

  private generatePersonalizedSettings(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    recommendations: DifficultyRecommendation[],
  ): {
    timeLimitAdjustment: number;
    hintFrequency: number;
    questionComplexity: number;
  } {
    const avgResponseTime = performance.averageResponseTime;
    const accuracyRate = performance.accuracyRate;
    const performanceLevel = performance.performanceLevel;

    // Time limit adjustment based on response time
    let timeLimitAdjustment = 1.0;
    if (avgResponseTime < 10000) {
      timeLimitAdjustment = 0.8; // Reduce time limit for fast players
    } else if (avgResponseTime > 25000) {
      timeLimitAdjustment = 1.3; // Increase time limit for slower players
    }

    // Hint frequency based on accuracy and performance level
    let hintFrequency = 0.3; // Default 30% of questions get hints
    if (accuracyRate < 0.6) {
      hintFrequency = 0.6; // More hints for struggling players
    } else if (accuracyRate > 0.9) {
      hintFrequency = 0.1; // Fewer hints for high performers
    }

    // Question complexity based on performance level and recommendations
    let questionComplexity = 0.5; // Default medium complexity
    if (performanceLevel === 'expert') {
      questionComplexity = 0.8;
    } else if (performanceLevel === 'beginner') {
      questionComplexity = 0.3;
    }

    // Adjust based on recommendations
    const increaseRecommendations = recommendations.filter(r => 
      this.getDifficultyDirection(r.currentDifficulty, r.recommendedDifficulty) === 'increase'
    ).length;
    
    if (increaseRecommendations > recommendations.length * 0.5) {
      questionComplexity = Math.min(1.0, questionComplexity + 0.2);
    }

    return {
      timeLimitAdjustment,
      hintFrequency,
      questionComplexity,
    };
  }
}
