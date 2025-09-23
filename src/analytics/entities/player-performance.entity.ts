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

export enum PerformanceLevel {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
  EXPERT = 'expert',
}

@Entity('player_performance')
@Index(['userId', 'createdAt'])
@Index(['userId', 'performanceLevel'])
export class PlayerPerformance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column({ name: 'total_rounds_played', default: 0 })
  totalRoundsPlayed: number;

  @Column({ name: 'total_correct_answers', default: 0 })
  totalCorrectAnswers: number;

  @Column({ name: 'total_incorrect_answers', default: 0 })
  totalIncorrectAnswers: number;

  @Column({ name: 'total_points_earned', default: 0 })
  totalPointsEarned: number;

  @Column({ name: 'average_response_time', type: 'decimal', precision: 10, scale: 2, default: 0 })
  averageResponseTime: number;

  @Column({ name: 'fastest_response_time', type: 'decimal', precision: 10, scale: 2, default: 0 })
  fastestResponseTime: number;

  @Column({ name: 'slowest_response_time', type: 'decimal', precision: 10, scale: 2, default: 0 })
  slowestResponseTime: number;

  @Column({ name: 'accuracy_rate', type: 'decimal', precision: 5, scale: 4, default: 0 })
  accuracyRate: number;

  @Column({ name: 'average_points_per_round', type: 'decimal', precision: 10, scale: 2, default: 0 })
  averagePointsPerRound: number;

  @Column({
    type: 'enum',
    enum: PerformanceLevel,
    default: PerformanceLevel.BEGINNER,
  })
  performanceLevel: PerformanceLevel;

  @Column('jsonb', { default: {} })
  categoryPerformance: {
    [category: string]: {
      roundsPlayed: number;
      correctAnswers: number;
      accuracyRate: number;
      averageResponseTime: number;
      pointsEarned: number;
    };
  };

  @Column('jsonb', { default: {} })
  difficultyPerformance: {
    [difficulty: string]: {
      roundsPlayed: number;
      correctAnswers: number;
      accuracyRate: number;
      averageResponseTime: number;
      pointsEarned: number;
    };
  };

  @Column('jsonb', { default: {} })
  questionTypePerformance: {
    [questionType: string]: {
      roundsPlayed: number;
      correctAnswers: number;
      accuracyRate: number;
      averageResponseTime: number;
      pointsEarned: number;
    };
  };

  @Column('jsonb', { default: [] })
  recentSessions: Array<{
    sessionId: string;
    date: Date;
    roundsPlayed: number;
    accuracyRate: number;
    pointsEarned: number;
    performanceLevel: PerformanceLevel;
  }>;

  @Column('jsonb', { default: {} })
  learningPatterns: {
    improvementAreas: string[];
    strengths: string[];
    learningVelocity: number; // rate of improvement over time
    consistencyScore: number; // how consistent performance is
    difficultyProgression: Array<{
      difficulty: string;
      date: Date;
      accuracyRate: number;
    }>;
  };

  @Column('jsonb', { default: {} })
  behavioralPatterns: {
    preferredQuestionTypes: string[];
    preferredCategories: string[];
    preferredDifficulty: string;
    averageSessionLength: number;
    peakPerformanceHours: number[]; // hours of day when performance is best
    responseTimePatterns: {
      quickDecisions: number; // percentage of answers given quickly
      thoughtfulDecisions: number; // percentage of answers given after thinking
    };
  };

  @Column('jsonb', { default: {} })
  cheatingIndicators: {
    suspiciousResponseTimes: number; // count of suspiciously fast responses
    patternAnomalies: number; // count of pattern anomalies
    consistencyViolations: number; // count of consistency violations
    riskScore: number; // overall cheating risk score (0-100)
    lastDetectionDate: Date | null;
  };

  @Column('jsonb', { default: {} })
  comparativeMetrics: {
    percentileRank: number; // player's percentile rank among all players
    categoryRankings: { [category: string]: number };
    difficultyRankings: { [difficulty: string]: number };
    questionTypeRankings: { [questionType: string]: number };
    globalAverageComparison: {
      accuracyRate: number;
      responseTime: number;
      pointsPerRound: number;
    };
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Helper methods
  calculateAccuracyRate(): number {
    const totalAnswers = this.totalCorrectAnswers + this.totalIncorrectAnswers;
    return totalAnswers > 0 ? this.totalCorrectAnswers / totalAnswers : 0;
  }

  calculateAveragePointsPerRound(): number {
    return this.totalRoundsPlayed > 0 ? this.totalPointsEarned / this.totalRoundsPlayed : 0;
  }

  updatePerformanceLevel(): void {
    const accuracy = this.accuracyRate;
    const avgPoints = this.averagePointsPerRound;
    const roundsPlayed = this.totalRoundsPlayed;

    if (roundsPlayed < 10) {
      this.performanceLevel = PerformanceLevel.BEGINNER;
    } else if (accuracy >= 0.9 && avgPoints >= 800) {
      this.performanceLevel = PerformanceLevel.EXPERT;
    } else if (accuracy >= 0.75 && avgPoints >= 600) {
      this.performanceLevel = PerformanceLevel.ADVANCED;
    } else if (accuracy >= 0.6 && avgPoints >= 400) {
      this.performanceLevel = PerformanceLevel.INTERMEDIATE;
    } else {
      this.performanceLevel = PerformanceLevel.BEGINNER;
    }
  }

  addSessionData(sessionData: {
    sessionId: string;
    roundsPlayed: number;
    accuracyRate: number;
    pointsEarned: number;
  }): void {
    this.recentSessions.unshift({
      ...sessionData,
      date: new Date(),
      performanceLevel: this.performanceLevel,
    });

    // Keep only last 20 sessions
    if (this.recentSessions.length > 20) {
      this.recentSessions = this.recentSessions.slice(0, 20);
    }
  }
}
