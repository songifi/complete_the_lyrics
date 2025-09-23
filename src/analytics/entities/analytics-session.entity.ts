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

export enum SessionType {
  GAME_SESSION = 'game_session',
  PRACTICE_SESSION = 'practice_session',
  TUTORIAL_SESSION = 'tutorial_session',
  TEST_SESSION = 'test_session',
}

export enum SessionStatus {
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ABANDONED = 'abandoned',
  PAUSED = 'paused',
}

@Entity('analytics_sessions')
@Index(['userId', 'sessionType'])
@Index(['userId', 'createdAt'])
@Index(['sessionStatus', 'createdAt'])
export class AnalyticsSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  @Index()
  userId: string;

  @Column({ name: 'game_session_id', nullable: true })
  gameSessionId: string;

  @Column({
    type: 'enum',
    enum: SessionType,
  })
  sessionType: SessionType;

  @Column({
    type: 'enum',
    enum: SessionStatus,
    default: SessionStatus.ACTIVE,
  })
  sessionStatus: SessionStatus;

  @Column('jsonb', { 
    default: {
      deviceInfo: {},
      networkInfo: {},
      gameSettings: {},
      customData: {}
    }
  })
  sessionMetadata: {
    deviceInfo?: {
      userAgent: string;
      platform: string;
      browser: string;
      screenResolution: string;
    };
    networkInfo?: {
      connectionType: string;
      latency: number;
    };
    gameSettings?: {
      difficulty: string;
      categories: string[];
      timeLimit: number;
      maxRounds: number;
    };
    customData?: Record<string, any>;
  };

  @Column('jsonb', { 
    default: {
      totalRounds: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalPoints: 0,
      averageResponseTime: 0,
      accuracyRate: 0,
      pointsPerRound: 0,
      timeSpent: 0,
      roundsCompleted: 0,
      roundsSkipped: 0,
      roundsAbandoned: 0
    }
  })
  performanceMetrics: {
    totalRounds: number;
    correctAnswers: number;
    incorrectAnswers: number;
    totalPoints: number;
    averageResponseTime: number;
    accuracyRate: number;
    pointsPerRound: number;
    timeSpent: number; // in milliseconds
    roundsCompleted: number;
    roundsSkipped: number;
    roundsAbandoned: number;
  };

  @Column('jsonb', { 
    default: {
      clickPatterns: [],
      keystrokePatterns: [],
      mouseMovements: [],
      focusEvents: [],
      scrollEvents: []
    }
  })
  behavioralMetrics: {
    clickPatterns: Array<{
      element: string;
      timestamp: Date;
      position: { x: number; y: number };
      duration: number;
    }>;
    keystrokePatterns: Array<{
      key: string;
      timestamp: Date;
      duration: number;
      context: string;
    }>;
    mouseMovements: Array<{
      x: number;
      y: number;
      timestamp: Date;
      velocity: number;
    }>;
    focusEvents: Array<{
      element: string;
      timestamp: Date;
      duration: number;
    }>;
    scrollEvents: Array<{
      position: number;
      timestamp: Date;
      direction: 'up' | 'down';
    }>;
  };

  @Column('jsonb', { 
    default: {
      suspiciousClicks: 0,
      rapidAnswerChanges: 0,
      copyPasteDetected: 0,
      tabSwitching: 0,
      suspiciousTiming: 0,
      patternAnomalies: 0,
      overallRiskScore: 0,
      flaggedEvents: []
    }
  })
  cheatingIndicators: {
    suspiciousClicks: number;
    rapidAnswerChanges: number;
    copyPasteDetected: number;
    tabSwitching: number;
    suspiciousTiming: number;
    patternAnomalies: number;
    overallRiskScore: number;
    flaggedEvents: Array<{
      type: string;
      timestamp: Date;
      description: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
    }>;
  };

  @Column('jsonb', { 
    default: {
      skillProgression: [],
      difficultyProgression: [],
      categoryPerformance: [],
      questionTypePerformance: []
    }
  })
  learningMetrics: {
    skillProgression: Array<{
      skill: string;
      startLevel: number;
      endLevel: number;
      improvement: number;
    }>;
    difficultyProgression: Array<{
      difficulty: string;
      accuracyRate: number;
      timestamp: Date;
    }>;
    categoryPerformance: Array<{
      category: string;
      accuracyRate: number;
      averageTime: number;
      improvement: number;
    }>;
    questionTypePerformance: Array<{
      questionType: string;
      accuracyRate: number;
      averageTime: number;
      improvement: number;
    }>;
  };

  @Column('jsonb', { 
    default: {
      peerComparison: {
        percentileRank: 0,
        betterThan: 0,
        worseThan: 0,
        similarTo: 0
      },
      historicalComparison: {
        previousSession: {
          accuracyRate: 0,
          averageTime: 0,
          pointsPerRound: 0
        },
        improvement: {
          accuracyRate: 0,
          averageTime: 0,
          pointsPerRound: 0
        }
      },
      categoryRankings: {},
      difficultyRankings: {}
    }
  })
  comparativeMetrics: {
    peerComparison: {
      percentileRank: number;
      betterThan: number;
      worseThan: number;
      similarTo: number;
    };
    historicalComparison: {
      previousSession: {
        accuracyRate: number;
        averageTime: number;
        pointsPerRound: number;
      };
      improvement: {
        accuracyRate: number;
        averageTime: number;
        pointsPerRound: number;
      };
    };
    categoryRankings: { [category: string]: number };
    difficultyRankings: { [difficulty: string]: number };
  };

  @Column('jsonb', { 
    default: {
      difficultyAdjustments: [],
      practiceSuggestions: [],
      improvementAreas: [],
      nextSteps: []
    }
  })
  recommendations: {
    difficultyAdjustments: Array<{
      category: string;
      currentDifficulty: string;
      recommendedDifficulty: string;
      reason: string;
    }>;
    practiceSuggestions: Array<{
      area: string;
      suggestion: string;
      priority: 'low' | 'medium' | 'high';
      expectedImpact: string;
    }>;
    improvementAreas: Array<{
      area: string;
      currentLevel: number;
      targetLevel: number;
      steps: string[];
    }>;
    nextSteps: Array<{
      action: string;
      description: string;
      priority: 'low' | 'medium' | 'high';
    }>;
  };

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs: number;

  @Column({ name: 'is_analyzed', default: false })
  isAnalyzed: boolean;

  @Column({ name: 'analysis_completed_at', type: 'timestamp', nullable: true })
  analysisCompletedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // Helper methods
  isActive(): boolean {
    return this.sessionStatus === SessionStatus.ACTIVE;
  }

  isCompleted(): boolean {
    return this.sessionStatus === SessionStatus.COMPLETED;
  }

  calculateDuration(): number {
    if (this.endedAt) {
      return this.endedAt.getTime() - this.startedAt.getTime();
    }
    return Date.now() - this.startedAt.getTime();
  }

  endSession(status: SessionStatus = SessionStatus.COMPLETED): void {
    this.sessionStatus = status;
    this.endedAt = new Date();
    this.durationMs = this.calculateDuration();
  }

  addBehavioralEvent(type: string, data: any): void {
    const timestamp = new Date();
    
    switch (type) {
      case 'click':
        const newClickPatterns = [
          ...this.behavioralMetrics.clickPatterns,
          {
            element: data.element,
            timestamp,
            position: data.position,
            duration: data.duration || 0,
          },
        ];
        this.behavioralMetrics = {
          ...this.behavioralMetrics,
          clickPatterns: newClickPatterns,
        };
        break;
      case 'keystroke':
        const newKeystrokePatterns = [
          ...this.behavioralMetrics.keystrokePatterns,
          {
            key: data.key,
            timestamp,
            duration: data.duration || 0,
            context: data.context || '',
          },
        ];
        this.behavioralMetrics = {
          ...this.behavioralMetrics,
          keystrokePatterns: newKeystrokePatterns,
        };
        break;
      case 'mouseMove':
        const newMouseMovements = [
          ...this.behavioralMetrics.mouseMovements,
          {
            x: data.x,
            y: data.y,
            timestamp,
            velocity: data.velocity || 0,
          },
        ];
        this.behavioralMetrics = {
          ...this.behavioralMetrics,
          mouseMovements: newMouseMovements,
        };
        break;
      case 'focus':
        const newFocusEvents = [
          ...this.behavioralMetrics.focusEvents,
          {
            element: data.element,
            timestamp,
            duration: data.duration || 0,
          },
        ];
        this.behavioralMetrics = {
          ...this.behavioralMetrics,
          focusEvents: newFocusEvents,
        };
        break;
      case 'scroll':
        const newScrollEvents = [
          ...this.behavioralMetrics.scrollEvents,
          {
            position: data.position,
            timestamp,
            direction: data.direction,
          },
        ];
        this.behavioralMetrics = {
          ...this.behavioralMetrics,
          scrollEvents: newScrollEvents,
        };
        break;
      default:
        throw new Error(`Unknown behavioral event type: ${type}`);
    }
  }

  addCheatingFlag(type: string, description: string, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    if (!this.cheatingIndicators) {
      this.cheatingIndicators = {
        suspiciousClicks: 0,
        rapidAnswerChanges: 0,
        copyPasteDetected: 0,
        tabSwitching: 0,
        suspiciousTiming: 0,
        patternAnomalies: 0,
        overallRiskScore: 0,
        flaggedEvents: [],
      };
    }

    if (!this.cheatingIndicators.flaggedEvents) {
      this.cheatingIndicators.flaggedEvents = [];
    }

    this.cheatingIndicators.flaggedEvents.push({
      type,
      timestamp: new Date(),
      description,
      severity,
    });
  }

  updatePerformanceMetrics(metrics: Partial<typeof this.performanceMetrics>): void {
    this.performanceMetrics = { ...this.performanceMetrics, ...metrics };
  }

  markAsAnalyzed(): void {
    this.isAnalyzed = true;
    this.analysisCompletedAt = new Date();
  }
}
