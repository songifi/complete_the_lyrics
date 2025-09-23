import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PlayerPerformance, PerformanceLevel } from '../entities/player-performance.entity';
import { AnswerPattern, PatternType } from '../entities/answer-pattern.entity';
import { GameRound, QuestionType } from '../../GameRound/entities/game-round.entity';

export interface ImprovementSuggestion {
  id: string;
  area: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'accuracy' | 'speed' | 'consistency' | 'knowledge' | 'strategy' | 'engagement';
  expectedImpact: {
    improvement: number; // percentage
    timeframe: string;
    confidence: number;
  };
  specificSteps: Array<{
    step: string;
    description: string;
    estimatedTime: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  practiceExercises: Array<{
    type: string;
    description: string;
    frequency: string;
    duration: string;
  }>;
  metrics: {
    currentValue: number;
    targetValue: number;
    measurement: string;
  };
  relatedPatterns: string[];
}

export interface PracticePlan {
  dailyGoals: {
    roundsToPlay: number;
    targetAccuracy: number;
    timeLimit: number;
    focusAreas: string[];
  };
  weeklyGoals: {
    improvementTarget: string;
    practiceSessions: number;
    skillFocus: string[];
  };
  monthlyGoals: {
    performanceLevel: PerformanceLevel;
    masteryAreas: string[];
    newChallenges: string[];
  };
  recommendedSchedule: {
    morning: string;
    afternoon: string;
    evening: string;
    weekend: string;
  };
  progressTracking: {
    keyMetrics: string[];
    checkpoints: Array<{
      date: Date;
      goals: string[];
    }>;
  };
}

export interface LearningPath {
  currentLevel: PerformanceLevel;
  targetLevel: PerformanceLevel;
  phases: Array<{
    name: string;
    duration: string;
    focus: string[];
    goals: string[];
    exercises: string[];
  }>;
  estimatedCompletion: Date;
  milestones: Array<{
    name: string;
    description: string;
    targetDate: Date;
    criteria: string[];
  }>;
}

@Injectable()
export class ImprovementSuggestionsService {
  private readonly logger = new Logger(ImprovementSuggestionsService.name);

  constructor(
    @InjectRepository(PlayerPerformance)
    private playerPerformanceRepository: Repository<PlayerPerformance>,
    @InjectRepository(AnswerPattern)
    private answerPatternRepository: Repository<AnswerPattern>,
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
  ) {}

  async generateSuggestions(
    userId: string,
    focusAreas?: string[],
    maxSuggestions: number = 5,
  ): Promise<ImprovementSuggestion[]> {
    const performance = await this.playerPerformanceRepository.findOne({
      where: { userId },
    });

    if (!performance) {
      throw new Error('Player performance data not found');
    }

    const patterns = await this.answerPatternRepository.find({
      where: { userId, isActive: true },
      order: { createdAt: 'DESC' },
      take: 30,
    });

    const recentRounds = await this.gameRoundRepository.find({
      where: { sessionId: performance.sessionId },
      order: { createdAt: 'DESC' },
      take: 50,
    });

    const suggestions: ImprovementSuggestion[] = [];

    // Generate suggestions based on different areas
    suggestions.push(...this.generateAccuracySuggestions(performance, patterns, recentRounds));
    suggestions.push(...this.generateSpeedSuggestions(performance, patterns, recentRounds));
    suggestions.push(...this.generateConsistencySuggestions(performance, patterns, recentRounds));
    suggestions.push(...this.generateKnowledgeSuggestions(performance, patterns, recentRounds));
    suggestions.push(...this.generateStrategySuggestions(performance, patterns, recentRounds));
    suggestions.push(...this.generateEngagementSuggestions(performance, patterns, recentRounds));

    // Filter by focus areas if specified
    if (focusAreas && focusAreas.length > 0) {
      const filteredSuggestions = suggestions.filter(suggestion =>
        focusAreas.some(area => suggestion.area.toLowerCase().includes(area.toLowerCase()))
      );
      return this.prioritizeAndLimit(filteredSuggestions, maxSuggestions);
    }

    return this.prioritizeAndLimit(suggestions, maxSuggestions);
  }

  async generatePracticePlan(
    userId: string,
    suggestions: ImprovementSuggestion[],
  ): Promise<PracticePlan> {
    const performance = await this.playerPerformanceRepository.findOne({
      where: { userId },
    });

    if (!performance) {
      throw new Error('Player performance data not found');
    }

    const currentLevel = performance.performanceLevel;
    const targetLevel = this.determineTargetLevel(currentLevel);

    return {
      dailyGoals: {
        roundsToPlay: this.calculateDailyRounds(performance, suggestions),
        targetAccuracy: Math.min(0.9, performance.accuracyRate + 0.1),
        timeLimit: Math.max(15000, performance.averageResponseTime * 0.8),
        focusAreas: suggestions.slice(0, 3).map(s => s.area),
      },
      weeklyGoals: {
        improvementTarget: this.calculateWeeklyTarget(performance, suggestions),
        practiceSessions: this.calculateWeeklySessions(performance),
        skillFocus: suggestions.map(s => s.area),
      },
      monthlyGoals: {
        performanceLevel: targetLevel,
        masteryAreas: this.identifyMasteryAreas(performance, suggestions),
        newChallenges: this.suggestNewChallenges(performance, suggestions),
      },
      recommendedSchedule: {
        morning: 'Quick 5-round warm-up focusing on speed',
        afternoon: 'Focused 15-round practice session',
        evening: 'Review and reflection on mistakes',
        weekend: 'Comprehensive skill assessment and new challenges',
      },
      progressTracking: {
        keyMetrics: this.identifyKeyMetrics(performance, suggestions),
        checkpoints: this.generateCheckpoints(performance, suggestions),
      },
    };
  }

  async generateLearningPath(userId: string): Promise<LearningPath> {
    const performance = await this.playerPerformanceRepository.findOne({
      where: { userId },
    });

    if (!performance) {
      throw new Error('Player performance data not found');
    }

    const currentLevel = performance.performanceLevel;
    const targetLevel = this.determineTargetLevel(currentLevel);

    const phases = this.generateLearningPhases(currentLevel, targetLevel);
    const milestones = this.generateMilestones(currentLevel, targetLevel);

    return {
      currentLevel,
      targetLevel,
      phases,
      estimatedCompletion: this.calculateEstimatedCompletion(phases),
      milestones,
    };
  }

  private generateAccuracySuggestions(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    rounds: GameRound[],
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    if (performance.accuracyRate < 0.7) {
      suggestions.push({
        id: 'accuracy-1',
        area: 'Answer Accuracy',
        title: 'Improve Answer Accuracy',
        description: 'Focus on getting more answers correct to increase your overall score',
        priority: 'high',
        category: 'accuracy',
        expectedImpact: {
          improvement: 20,
          timeframe: '2-3 weeks',
          confidence: 85,
        },
        specificSteps: [
          {
            step: 'Read questions carefully',
            description: 'Take time to fully understand what each question is asking',
            estimatedTime: '5 minutes per question',
            difficulty: 'easy',
          },
          {
            step: 'Eliminate wrong answers',
            description: 'Use process of elimination to narrow down choices',
            estimatedTime: '2-3 minutes per question',
            difficulty: 'medium',
          },
          {
            step: 'Review incorrect answers',
            description: 'Study your mistakes to learn from them',
            estimatedTime: '10 minutes daily',
            difficulty: 'easy',
          },
        ],
        practiceExercises: [
          {
            type: 'Accuracy Drills',
            description: 'Practice with easier questions to build confidence',
            frequency: 'Daily',
            duration: '15 minutes',
          },
          {
            type: 'Mistake Analysis',
            description: 'Review and analyze your incorrect answers',
            frequency: 'After each session',
            duration: '10 minutes',
          },
        ],
        metrics: {
          currentValue: performance.accuracyRate * 100,
          targetValue: 80,
          measurement: 'Percentage of correct answers',
        },
        relatedPatterns: patterns.filter(p => p.patternType === PatternType.ACCURACY).map(p => p.id),
      });
    }

    return suggestions;
  }

  private generateSpeedSuggestions(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    rounds: GameRound[],
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    if (performance.averageResponseTime > 20000) {
      suggestions.push({
        id: 'speed-1',
        area: 'Response Speed',
        title: 'Improve Response Speed',
        description: 'Learn to answer questions faster while maintaining accuracy',
        priority: 'medium',
        category: 'speed',
        expectedImpact: {
          improvement: 25,
          timeframe: '3-4 weeks',
          confidence: 75,
        },
        specificSteps: [
          {
            step: 'Practice with time pressure',
            description: 'Set shorter time limits to practice quick decision making',
            estimatedTime: '10 minutes per session',
            difficulty: 'medium',
          },
          {
            step: 'Learn quick recognition',
            description: 'Develop pattern recognition for common question types',
            estimatedTime: '20 minutes daily',
            difficulty: 'hard',
          },
          {
            step: 'Build confidence',
            description: 'Practice with easier questions to build speed confidence',
            estimatedTime: '15 minutes daily',
            difficulty: 'easy',
          },
        ],
        practiceExercises: [
          {
            type: 'Speed Drills',
            description: 'Practice answering questions under time pressure',
            frequency: 'Daily',
            duration: '20 minutes',
          },
          {
            type: 'Pattern Recognition',
            description: 'Learn to quickly identify question patterns',
            frequency: '3 times per week',
            duration: '30 minutes',
          },
        ],
        metrics: {
          currentValue: performance.averageResponseTime / 1000,
          targetValue: 15,
          measurement: 'Average response time in seconds',
        },
        relatedPatterns: patterns.filter(p => p.patternType === PatternType.RESPONSE_TIME).map(p => p.id),
      });
    }

    return suggestions;
  }

  private generateConsistencySuggestions(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    rounds: GameRound[],
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    const consistencyScore = this.calculateConsistencyScore(performance, patterns);
    
    if (consistencyScore < 0.6) {
      suggestions.push({
        id: 'consistency-1',
        area: 'Performance Consistency',
        title: 'Improve Performance Consistency',
        description: 'Work on maintaining steady performance across different sessions',
        priority: 'medium',
        category: 'consistency',
        expectedImpact: {
          improvement: 15,
          timeframe: '4-6 weeks',
          confidence: 70,
        },
        specificSteps: [
          {
            step: 'Establish routine',
            description: 'Create a consistent practice schedule',
            estimatedTime: '30 minutes daily',
            difficulty: 'easy',
          },
          {
            step: 'Track performance',
            description: 'Monitor your performance metrics regularly',
            estimatedTime: '5 minutes daily',
            difficulty: 'easy',
          },
          {
            step: 'Identify patterns',
            description: 'Understand what affects your performance',
            estimatedTime: '15 minutes weekly',
            difficulty: 'medium',
          },
        ],
        practiceExercises: [
          {
            type: 'Consistent Practice',
            description: 'Practice at the same time each day',
            frequency: 'Daily',
            duration: '30 minutes',
          },
          {
            type: 'Performance Tracking',
            description: 'Keep a log of your daily performance',
            frequency: 'Daily',
            duration: '5 minutes',
          },
        ],
        metrics: {
          currentValue: consistencyScore * 100,
          targetValue: 75,
          measurement: 'Consistency score (0-100)',
        },
        relatedPatterns: patterns.filter(p => p.patternType === PatternType.CONSISTENCY).map(p => p.id),
      });
    }

    return suggestions;
  }

  private generateKnowledgeSuggestions(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    rounds: GameRound[],
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    // Analyze category performance
    const weakCategories = this.identifyWeakCategories(performance);
    
    weakCategories.forEach((category, index) => {
      suggestions.push({
        id: `knowledge-${index + 1}`,
        area: `${category} Knowledge`,
        title: `Improve ${category} Knowledge`,
        description: `Build your knowledge in the ${category} category`,
        priority: 'medium',
        category: 'knowledge',
        expectedImpact: {
          improvement: 30,
          timeframe: '6-8 weeks',
          confidence: 80,
        },
        specificSteps: [
          {
            step: 'Study the basics',
            description: `Learn fundamental concepts in ${category}`,
            estimatedTime: '1 hour daily',
            difficulty: 'medium',
          },
          {
            step: 'Practice regularly',
            description: `Practice ${category} questions daily`,
            estimatedTime: '30 minutes daily',
            difficulty: 'easy',
          },
          {
            step: 'Explore advanced topics',
            description: `Dive deeper into ${category} concepts`,
            estimatedTime: '45 minutes daily',
            difficulty: 'hard',
          },
        ],
        practiceExercises: [
          {
            type: 'Category Study',
            description: `Focused study on ${category} topics`,
            frequency: 'Daily',
            duration: '1 hour',
          },
          {
            type: 'Practice Questions',
            description: `Practice ${category} questions`,
            frequency: 'Daily',
            duration: '30 minutes',
          },
        ],
        metrics: {
          currentValue: performance.categoryPerformance[category]?.accuracyRate * 100 || 0,
          targetValue: 75,
          measurement: `Accuracy in ${category} questions (%)`,
        },
        relatedPatterns: patterns.filter(p => p.patternType === PatternType.CATEGORY_PREFERENCE).map(p => p.id),
      });
    });

    return suggestions;
  }

  private generateStrategySuggestions(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    rounds: GameRound[],
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    suggestions.push({
      id: 'strategy-1',
      area: 'Answer Strategy',
      title: 'Develop Better Answer Strategies',
      description: 'Learn effective strategies for different types of questions',
      priority: 'medium',
      category: 'strategy',
      expectedImpact: {
        improvement: 20,
        timeframe: '2-3 weeks',
        confidence: 75,
      },
      specificSteps: [
        {
          step: 'Learn question types',
          description: 'Understand different question formats and how to approach them',
          estimatedTime: '30 minutes',
          difficulty: 'easy',
        },
        {
          step: 'Practice elimination',
          description: 'Master the process of elimination technique',
          estimatedTime: '20 minutes daily',
          difficulty: 'medium',
        },
        {
          step: 'Time management',
          description: 'Learn to allocate time effectively across questions',
          estimatedTime: '15 minutes daily',
          difficulty: 'medium',
        },
      ],
      practiceExercises: [
        {
          type: 'Strategy Practice',
          description: 'Practice different answering strategies',
          frequency: 'Daily',
          duration: '30 minutes',
        },
        {
          type: 'Time Management',
          description: 'Practice with time constraints',
          frequency: '3 times per week',
          duration: '20 minutes',
        },
      ],
      metrics: {
        currentValue: performance.averagePointsPerRound,
        targetValue: performance.averagePointsPerRound * 1.2,
        measurement: 'Average points per round',
      },
      relatedPatterns: patterns.filter(p => p.patternType === PatternType.QUESTION_TYPE_PREFERENCE).map(p => p.id),
    });

    return suggestions;
  }

  private generateEngagementSuggestions(
    performance: PlayerPerformance,
    patterns: AnswerPattern[],
    rounds: GameRound[],
  ): ImprovementSuggestion[] {
    const suggestions: ImprovementSuggestion[] = [];

    const engagementScore = this.calculateEngagementScore(performance, patterns);
    
    if (engagementScore < 0.6) {
      suggestions.push({
        id: 'engagement-1',
        area: 'Learning Engagement',
        title: 'Increase Learning Engagement',
        description: 'Make your learning experience more engaging and motivating',
        priority: 'low',
        category: 'engagement',
        expectedImpact: {
          improvement: 25,
          timeframe: '2-4 weeks',
          confidence: 70,
        },
        specificSteps: [
          {
            step: 'Set personal goals',
            description: 'Create specific, achievable learning goals',
            estimatedTime: '10 minutes',
            difficulty: 'easy',
          },
          {
            step: 'Track progress',
            description: 'Monitor your improvement over time',
            estimatedTime: '5 minutes daily',
            difficulty: 'easy',
          },
          {
            step: 'Celebrate achievements',
            description: 'Acknowledge and celebrate your progress',
            estimatedTime: '5 minutes daily',
            difficulty: 'easy',
          },
        ],
        practiceExercises: [
          {
            type: 'Goal Setting',
            description: 'Set and track personal learning goals',
            frequency: 'Weekly',
            duration: '15 minutes',
          },
          {
            type: 'Progress Review',
            description: 'Review your progress and achievements',
            frequency: 'Daily',
            duration: '5 minutes',
          },
        ],
        metrics: {
          currentValue: engagementScore * 100,
          targetValue: 80,
          measurement: 'Engagement score (0-100)',
        },
        relatedPatterns: patterns.filter(p => p.patternType === PatternType.LEARNING_CURVE).map(p => p.id),
      });
    }

    return suggestions;
  }

  private prioritizeAndLimit(suggestions: ImprovementSuggestion[], maxSuggestions: number): ImprovementSuggestion[] {
    // Sort by priority and expected impact
    const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    
    suggestions.sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      return b.expectedImpact.improvement - a.expectedImpact.improvement;
    });

    return suggestions.slice(0, maxSuggestions);
  }

  private calculateConsistencyScore(performance: PlayerPerformance, patterns: AnswerPattern[]): number {
    const consistencyPattern = patterns.find(p => p.patternType === PatternType.CONSISTENCY);
    return consistencyPattern?.patternData?.consistencyData?.consistencyScore || 0.5;
  }

  private identifyWeakCategories(performance: PlayerPerformance): string[] {
    const categories = Object.keys(performance.categoryPerformance);
    return categories.filter(category => {
      const perf = performance.categoryPerformance[category];
      return perf.accuracyRate < 0.6;
    });
  }

  private calculateEngagementScore(performance: PlayerPerformance, patterns: AnswerPattern[]): number {
    const weights = {
      sessionFrequency: 0.3,    // How often they play
      completionRate: 0.25,     // How often they complete sessions/rounds
      timeInvestment: 0.2,      // How much time they spend
      consistency: 0.15,        // How consistent their engagement is
      progression: 0.1,         // Signs of learning/improvement
    };

    const sessionFrequencyScore = this.calculateSessionFrequencyScore(performance);
    const completionRateScore = this.calculateCompletionRateScore(performance);
    const timeInvestmentScore = this.calculateTimeInvestmentScore(performance, patterns);
    const consistencyScore = this.calculateEngagementConsistencyScore(performance, patterns);
    const progressionScore = this.calculateProgressionScore(performance, patterns);
    const engagementScore = 
      sessionFrequencyScore * weights.sessionFrequency +
      completionRateScore * weights.completionRate +
      timeInvestmentScore * weights.timeInvestment +
      consistencyScore * weights.consistency +
      progressionScore * weights.progression;

    return Math.max(0, Math.min(1, engagementScore));
  }

  private calculateSessionFrequencyScore(performance: PlayerPerformance): number {
    const recentSessions = performance.recentSessions || [];
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sessionsLastWeek = recentSessions.filter(session => 
      new Date(session.date) >= oneWeekAgo
    ).length;
    
    const sessionsLastMonth = recentSessions.filter(session => 
      new Date(session.date) >= oneMonthAgo
    ).length;

    const weeklyScore = Math.min(1, sessionsLastWeek / 3);
    const monthlyScore = Math.min(1, sessionsLastMonth / 10);
    
    return (weeklyScore + monthlyScore) / 2;
  }

  private calculateCompletionRateScore(performance: PlayerPerformance): number {
    const recentSessions = performance.recentSessions || [];
    
    if (recentSessions.length === 0) {
      return 0;
    }

    const avgRoundsPerSession = recentSessions.reduce((sum, session) => 
      sum + session.roundsPlayed, 0) / recentSessions.length;
    
    const avgAccuracyPerSession = recentSessions.reduce((sum, session) => 
      sum + session.accuracyRate, 0) / recentSessions.length;

    const expectedRoundsPerSession = 10;
    const minAccuracyForCompletion = 0.4;
    
    const roundsCompletionRate = Math.min(1, avgRoundsPerSession / expectedRoundsPerSession);
    const accuracyCompletionRate = avgAccuracyPerSession >= minAccuracyForCompletion ? 1 : 
      avgAccuracyPerSession / minAccuracyForCompletion;
    
    return (roundsCompletionRate + accuracyCompletionRate) / 2;
  }

  private calculateTimeInvestmentScore(performance: PlayerPerformance, patterns: AnswerPattern[]): number {
    const responseTimePattern = patterns.find(p => p.patternType === PatternType.RESPONSE_TIME);
    const consistencyPattern = patterns.find(p => p.patternType === PatternType.CONSISTENCY);
    
    let timeScore = 0.5;
    if (responseTimePattern?.patternData.responseTimeData) {
      const responseData = responseTimePattern.patternData.responseTimeData;
      
      const avgTime = responseData.averageTime;
      const isReasonableTime = avgTime >= 2 && avgTime <= 30;
      const isConsistent = responseData.consistencyScore > 0.7;
      
      if (isReasonableTime && isConsistent) {
        timeScore += 0.3;
      } else if (isReasonableTime) {
        timeScore += 0.2;
      }
    }
    
    if (performance.behavioralPatterns?.averageSessionLength) {
      const avgSessionLength = performance.behavioralPatterns.averageSessionLength;
      if (avgSessionLength >= 15) {
        timeScore += 0.2;
      } else if (avgSessionLength >= 10) {
        timeScore += 0.1;
      }
    }
    
    return Math.min(1, timeScore);
  }

  private calculateEngagementConsistencyScore(performance: PlayerPerformance, patterns: AnswerPattern[]): number {
    const consistencyPattern = patterns.find(p => p.patternType === PatternType.CONSISTENCY);
    const recentSessions = performance.recentSessions || [];
    
    if (recentSessions.length < 3) {
      return 0.5;
    }
    
    let consistencyScore = 0.5;
    if (consistencyPattern?.patternData.consistencyData) {
      const consistencyData = consistencyPattern.patternData.consistencyData;
      consistencyScore = consistencyData.consistencyScore / 100;
    } else {
      const accuracyValues = recentSessions.map(s => s.accuracyRate);
      const avgAccuracy = accuracyValues.reduce((sum, acc) => sum + acc, 0) / accuracyValues.length;
      const variance = accuracyValues.reduce((sum, acc) => sum + Math.pow(acc - avgAccuracy, 2), 0) / accuracyValues.length;
      const standardDeviation = Math.sqrt(variance);
      
      const coefficientOfVariation = standardDeviation / avgAccuracy;
      consistencyScore = Math.max(0, 1 - coefficientOfVariation);
    }
    
    return Math.min(1, consistencyScore);
  }

  private calculateProgressionScore(performance: PlayerPerformance, patterns: AnswerPattern[]): number {
    const learningPattern = patterns.find(p => p.patternType === PatternType.LEARNING_CURVE);
    const recentSessions = performance.recentSessions || [];
    
    if (recentSessions.length < 5) {
      return 0.5;
    }
    
    let progressionScore = 0.5;
    if (learningPattern?.patternData.learningCurveData) {
      const learningData = learningPattern.patternData.learningCurveData;
      const improvementRate = learningData.improvementRate;
      
      if (improvementRate > 0.1) {
        progressionScore += 0.4;
      } else if (improvementRate > 0.05) {
        progressionScore += 0.2;
      }
      const recentBreakthroughs = learningData.breakthroughPoints.filter(date => {
        const breakthroughDate = new Date(date);
        const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        return breakthroughDate >= oneMonthAgo;
      });
      
      if (recentBreakthroughs.length > 0) {
        progressionScore += 0.1;
      }
    } else {
      const sortedSessions = recentSessions
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      if (sortedSessions.length >= 3) {
        const firstThird = sortedSessions.slice(0, Math.ceil(sortedSessions.length / 3));
        const lastThird = sortedSessions.slice(-Math.ceil(sortedSessions.length / 3));
        
        const earlyAvgAccuracy = firstThird.reduce((sum, s) => sum + s.accuracyRate, 0) / firstThird.length;
        const recentAvgAccuracy = lastThird.reduce((sum, s) => sum + s.accuracyRate, 0) / lastThird.length;
        
        const improvement = recentAvgAccuracy - earlyAvgAccuracy;
        if (improvement > 0.1) {
          progressionScore += 0.3;
        } else if (improvement > 0.05) {
          progressionScore += 0.2;
        } else if (improvement > 0) {
          progressionScore += 0.1;
        }
      }
    }
    
    return Math.min(1, progressionScore);
  }

  private determineTargetLevel(currentLevel: PerformanceLevel): PerformanceLevel {
    const levels = [PerformanceLevel.BEGINNER, PerformanceLevel.INTERMEDIATE, PerformanceLevel.ADVANCED, PerformanceLevel.EXPERT];
    const currentIndex = levels.indexOf(currentLevel);
    return levels[Math.min(currentIndex + 1, levels.length - 1)];
  }

  private calculateDailyRounds(performance: PlayerPerformance, suggestions: ImprovementSuggestion[]): number {
    const baseRounds = 10;
    const highPrioritySuggestions = suggestions.filter(s => s.priority === 'high' || s.priority === 'critical');
    return baseRounds + (highPrioritySuggestions.length * 2);
  }

  private calculateWeeklyTarget(performance: PlayerPerformance, suggestions: ImprovementSuggestion[]): string {
    if (suggestions.length === 0) {
      return 'Improve overall performance by 0%';
    }
    const avgImprovement = suggestions.reduce((sum, s) => sum + s.expectedImpact.improvement, 0) / suggestions.length;
    return `Improve overall performance by ${Math.round(avgImprovement)}%`;
  }

  private calculateWeeklySessions(performance: PlayerPerformance): number {
    return 5; // 5 sessions per week
  }

  private identifyMasteryAreas(performance: PlayerPerformance, suggestions: ImprovementSuggestion[]): string[] {
    const categories = Object.keys(performance.categoryPerformance);
    return categories.filter(category => {
      const perf = performance.categoryPerformance[category];
      return perf.accuracyRate > 0.8;
    });
  }

  private suggestNewChallenges(performance: PlayerPerformance, suggestions: ImprovementSuggestion[]): string[] {
    return [
      'Try expert-level questions',
      'Explore new music genres',
      'Participate in timed challenges',
      'Compete with other players',
    ];
  }

  private identifyKeyMetrics(performance: PlayerPerformance, suggestions: ImprovementSuggestion[]): string[] {
    return [
      'Accuracy Rate',
      'Average Response Time',
      'Points per Round',
      'Consistency Score',
    ];
  }

  private generateCheckpoints(performance: PlayerPerformance, suggestions: ImprovementSuggestion[]): Array<{
    date: Date;
    goals: string[];
  }> {
    const checkpoints = [];
    const now = new Date();
    
    for (let i = 1; i <= 4; i++) {
      const date = new Date(now.getTime() + (i * 7 * 24 * 60 * 60 * 1000)); // Weekly checkpoints
      checkpoints.push({
        date,
        goals: suggestions.slice(0, 3).map(s => `Improve ${s.area}`),
      });
    }
    
    return checkpoints;
  }

  private generateLearningPhases(currentLevel: PerformanceLevel, targetLevel: PerformanceLevel): Array<{
    name: string;
    duration: string;
    focus: string[];
    goals: string[];
    exercises: string[];
  }> {
    const phases = [];
    
    if (currentLevel === PerformanceLevel.BEGINNER && targetLevel === PerformanceLevel.INTERMEDIATE) {
      phases.push({
        name: 'Foundation Building',
        duration: '2-3 weeks',
        focus: ['Basic accuracy', 'Question understanding'],
        goals: ['Achieve 70% accuracy', 'Complete 100 practice rounds'],
        exercises: ['Easy question drills', 'Mistake analysis'],
      });
    }
    
    if (currentLevel === PerformanceLevel.INTERMEDIATE && targetLevel === PerformanceLevel.ADVANCED) {
      phases.push({
        name: 'Skill Refinement',
        duration: '3-4 weeks',
        focus: ['Strategy development', 'Speed optimization', 'Complex problem solving'],
        goals: ['Achieve 85% accuracy', 'Complete 200 mixed-difficulty rounds', 'Reduce average response time by 30%'],
        exercises: ['Timed drills', 'Mixed-difficulty question sets', 'Strategy workshops', 'Pattern recognition training'],
      });
    }
    
    if (currentLevel === PerformanceLevel.ADVANCED && targetLevel === PerformanceLevel.EXPERT) {
      phases.push({
        name: 'Mastery Development',
        duration: '4-6 weeks',
        focus: ['Advanced strategy', 'Consistent high performance', 'Knowledge synthesis'],
        goals: ['Achieve 95% accuracy', 'Complete 500 expert-level rounds', 'Maintain 90%+ accuracy under time pressure'],
        exercises: ['Expert-level timed challenges', 'Mock competitions', 'Peer review sessions', 'Advanced pattern analysis'],
      });
    }
    
    // Handle multi-level transitions
    if (currentLevel === PerformanceLevel.BEGINNER && targetLevel === PerformanceLevel.ADVANCED) {
      phases.push(
        {
          name: 'Foundation Building',
          duration: '2-3 weeks',
          focus: ['Basic accuracy', 'Question understanding'],
          goals: ['Achieve 70% accuracy', 'Complete 100 practice rounds'],
          exercises: ['Easy question drills', 'Mistake analysis'],
        },
        {
          name: 'Skill Refinement',
          duration: '3-4 weeks',
          focus: ['Strategy development', 'Speed optimization', 'Complex problem solving'],
          goals: ['Achieve 85% accuracy', 'Complete 200 mixed-difficulty rounds', 'Reduce average response time by 30%'],
          exercises: ['Timed drills', 'Mixed-difficulty question sets', 'Strategy workshops', 'Pattern recognition training'],
        }
      );
    }
    
    if (currentLevel === PerformanceLevel.BEGINNER && targetLevel === PerformanceLevel.EXPERT) {
      phases.push(
        {
          name: 'Foundation Building',
          duration: '2-3 weeks',
          focus: ['Basic accuracy', 'Question understanding'],
          goals: ['Achieve 70% accuracy', 'Complete 100 practice rounds'],
          exercises: ['Easy question drills', 'Mistake analysis'],
        },
        {
          name: 'Skill Refinement',
          duration: '3-4 weeks',
          focus: ['Strategy development', 'Speed optimization', 'Complex problem solving'],
          goals: ['Achieve 85% accuracy', 'Complete 200 mixed-difficulty rounds', 'Reduce average response time by 30%'],
          exercises: ['Timed drills', 'Mixed-difficulty question sets', 'Strategy workshops', 'Pattern recognition training'],
        },
        {
          name: 'Mastery Development',
          duration: '4-6 weeks',
          focus: ['Advanced strategy', 'Consistent high performance', 'Knowledge synthesis'],
          goals: ['Achieve 95% accuracy', 'Complete 500 expert-level rounds', 'Maintain 90%+ accuracy under time pressure'],
          exercises: ['Expert-level timed challenges', 'Mock competitions', 'Peer review sessions', 'Advanced pattern analysis'],
        }
      );
    }
    
    if (currentLevel === PerformanceLevel.INTERMEDIATE && targetLevel === PerformanceLevel.EXPERT) {
      phases.push(
        {
          name: 'Skill Refinement',
          duration: '3-4 weeks',
          focus: ['Strategy development', 'Speed optimization', 'Complex problem solving'],
          goals: ['Achieve 85% accuracy', 'Complete 200 mixed-difficulty rounds', 'Reduce average response time by 30%'],
          exercises: ['Timed drills', 'Mixed-difficulty question sets', 'Strategy workshops', 'Pattern recognition training'],
        },
        {
          name: 'Mastery Development',
          duration: '4-6 weeks',
          focus: ['Advanced strategy', 'Consistent high performance', 'Knowledge synthesis'],
          goals: ['Achieve 95% accuracy', 'Complete 500 expert-level rounds', 'Maintain 90%+ accuracy under time pressure'],
          exercises: ['Expert-level timed challenges', 'Mock competitions', 'Peer review sessions', 'Advanced pattern analysis'],
        }
      );
    }
    
    return phases;
  }

  private generateMilestones(currentLevel: PerformanceLevel, targetLevel: PerformanceLevel): Array<{
    name: string;
    description: string;
    targetDate: Date;
    criteria: string[];
  }> {
    const milestones = [];
    const now = new Date();
    
    milestones.push({
      name: 'Accuracy Milestone',
      description: 'Achieve 80% accuracy rate',
      targetDate: new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)), // 30 days
      criteria: ['80% accuracy for 5 consecutive sessions'],
    });
    
    return milestones;
  }

  private calculateEstimatedCompletion(phases: Array<{ duration: string }>): Date {
    const now = new Date();
    let totalWeeks = 0;
    
    phases.forEach(phase => {
      const weeks = parseInt(phase.duration.split('-')[0]);
      totalWeeks += weeks;
    });
    
    return new Date(now.getTime() + (totalWeeks * 7 * 24 * 60 * 60 * 1000));
  }
}
