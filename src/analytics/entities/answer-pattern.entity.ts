import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../User/user.entity';
import { GameRound, QuestionType } from '../../GameRound/entities/game-round.entity';

export enum PatternType {
  RESPONSE_TIME = 'response_time',
  ACCURACY = 'accuracy',
  DIFFICULTY_PREFERENCE = 'difficulty_preference',
  CATEGORY_PREFERENCE = 'category_preference',
  QUESTION_TYPE_PREFERENCE = 'question_type_preference',
  LEARNING_CURVE = 'learning_curve',
  CONSISTENCY = 'consistency',
  CHEATING_SUSPICION = 'cheating_suspicion',
}

export enum PatternSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

@Entity('answer_patterns')
@Index(['userId', 'patternType'])
@Index(['userId', 'createdAt'])
@Index(['patternType', 'severity'])
export class AnswerPattern {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column({ name: 'round_id', nullable: true })
  roundId: string;

  @Column({
    type: 'enum',
    enum: PatternType,
  })
  patternType: PatternType;

  @Column({
    type: 'enum',
    enum: PatternSeverity,
    default: PatternSeverity.LOW,
  })
  severity: PatternSeverity;

  @Column('jsonb')
  patternData: {
    // Response time patterns
    responseTimeData?: {
      averageTime: number;
      standardDeviation: number;
      outliers: number[];
      trend: 'increasing' | 'decreasing' | 'stable';
      consistencyScore: number;
    };

    // Accuracy patterns
    accuracyData?: {
      overallAccuracy: number;
      accuracyByCategory: { [category: string]: number };
      accuracyByDifficulty: { [difficulty: string]: number };
      accuracyByQuestionType: { [questionType: string]: number };
      accuracyTrend: 'improving' | 'declining' | 'stable';
      streakData: {
        longestCorrectStreak: number;
        longestIncorrectStreak: number;
        currentStreak: number;
      };
    };

    // Preference patterns
    preferenceData?: {
      preferredCategories: Array<{ category: string; frequency: number; accuracy: number }>;
      preferredDifficulties: Array<{ difficulty: string; frequency: number; accuracy: number }>;
      preferredQuestionTypes: Array<{ questionType: string; frequency: number; accuracy: number }>;
      avoidancePatterns: string[]; // categories/difficulties player avoids
    };

    // Learning curve patterns
    learningCurveData?: {
      improvementRate: number; // rate of improvement over time
      plateauPoints: Date[]; // when learning plateaued
      breakthroughPoints: Date[]; // when significant improvement occurred
      skillDecayRate: number; // how quickly skills decay without practice
      optimalPracticeFrequency: number; // recommended practice frequency
    };

    // Consistency patterns
    consistencyData?: {
      performanceVariance: number; // how much performance varies
      timeOfDayConsistency: { [hour: number]: number }; // performance by hour
      dayOfWeekConsistency: { [day: number]: number }; // performance by day
      sessionLengthConsistency: { [length: string]: number }; // performance by session length
      consistencyScore: number; // overall consistency (0-100)
    };

    // Cheating suspicion patterns
    cheatingSuspicionData?: {
      suspiciousResponseTimes: Array<{
        roundId: string;
        responseTime: number;
        expectedTime: number;
        suspicionScore: number;
      }>;
      patternAnomalies: Array<{
        type: string;
        description: string;
        severity: PatternSeverity;
        detectedAt: Date;
      }>;
      consistencyViolations: Array<{
        type: string;
        description: string;
        severity: PatternSeverity;
        detectedAt: Date;
      }>;
      overallRiskScore: number; // 0-100
    };

    // Comparative patterns
    comparativeData?: {
      percentileRank: number;
      categoryRankings: { [category: string]: number };
      difficultyRankings: { [difficulty: string]: number };
      questionTypeRankings: { [questionType: string]: number };
      peerComparison: {
        betterThan: number; // percentage of peers
        worseThan: number; // percentage of peers
        similarTo: number; // percentage of peers with similar performance
      };
    };

    // Metadata
    metadata?: {
      analysisDate: Date;
      dataPoints: number;
      confidence: number; // confidence in pattern accuracy (0-100)
      lastUpdated: Date;
      version: string;
    };
  };

  @Column('jsonb', { default: {} })
  recommendations: {
    improvementSuggestions: Array<{
      area: string;
      suggestion: string;
      priority: 'low' | 'medium' | 'high';
      expectedImpact: string;
    }>;
    difficultyAdjustments: Array<{
      category: string;
      currentDifficulty: string;
      recommendedDifficulty: string;
      reason: string;
    }>;
    practiceRecommendations: Array<{
      type: string;
      frequency: string;
      duration: string;
      focus: string[];
    }>;
    cheatingPrevention: Array<{
      measure: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
    }>;
  };

  @Column('jsonb', { default: {} })
  alerts: {
    activeAlerts: Array<{
      type: string;
      message: string;
      severity: PatternSeverity;
      createdAt: Date;
      acknowledged: boolean;
    }>;
    resolvedAlerts: Array<{
      type: string;
      message: string;
      severity: PatternSeverity;
      createdAt: Date;
      resolvedAt: Date;
    }>;
  };

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'confidence_score', type: 'decimal', precision: 5, scale: 2, default: 0 })
  confidenceScore: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => GameRound, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'round_id' })
  round: GameRound;

  // Helper methods
  isHighSeverity(): boolean {
    return this.severity === PatternSeverity.HIGH || this.severity === PatternSeverity.CRITICAL;
  }

  isCheatingSuspicion(): boolean {
    return this.patternType === PatternType.CHEATING_SUSPICION;
  }

  getActiveAlerts(): Array<{
    type: string;
    message: string;
    severity: PatternSeverity;
    createdAt: Date;
  }> {
    return this.alerts.activeAlerts.filter(alert => !alert.acknowledged);
  }

  addAlert(type: string, message: string, severity: PatternSeverity): void {
    this.alerts.activeAlerts.push({
      type,
      message,
      severity,
      createdAt: new Date(),
      acknowledged: false,
    });
  }

  resolveAlert(alertIndex: number): void {
    if (alertIndex >= 0 && alertIndex < this.alerts.activeAlerts.length) {
      const alert = this.alerts.activeAlerts.splice(alertIndex, 1)[0];
      this.alerts.resolvedAlerts.push({
        ...alert,
        resolvedAt: new Date(),
      });
    }
  }

  updateConfidenceScore(score: number): void {
    this.confidenceScore = Math.max(0, Math.min(100, score));
  }
}
