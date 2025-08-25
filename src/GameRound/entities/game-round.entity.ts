import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { GameSession } from './game-session.entity';
import { Song } from './song.entity';

export enum QuestionType {
  MULTIPLE_CHOICE = 'multiple_choice',
  TRUE_FALSE = 'true_false',
  FILL_IN_BLANK = 'fill_in_blank',
  AUDIO_CLIP = 'audio_clip',
  LYRICS_GUESS = 'lyrics_guess',
}

export enum RoundStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
}

@Entity('game_rounds')
@Index(['sessionId', 'roundNumber'])
@Index(['sessionId', 'status'])
@Index(['createdAt'])
export class GameRound {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  @Index()
  sessionId: string;

  @Column({ name: 'song_id' })
  @Index()
  songId: string;

  @Column({ name: 'round_number' })
  roundNumber: number;

  @Column({
    type: 'enum',
    enum: QuestionType,
    name: 'question_type',
  })
  questionType: QuestionType;

  @Column({
    type: 'enum',
    enum: RoundStatus,
    default: RoundStatus.PENDING,
  })
  status: RoundStatus;

  // Question data stored as JSON
  @Column('jsonb')
  questionData: {
    question: string;
    options?: string[];
    correctAnswer: string | number;
    hints?: string[];
    audioClipStart?: number; // seconds
    audioClipDuration?: number; // seconds
    lyricsSnippet?: string;
  };

  // Player answers stored as JSON
  @Column('jsonb', { default: {} })
  answers: Record<string, {
    answer: string | number;
    submittedAt: Date;
    timeElapsed: number; // milliseconds
    isCorrect: boolean;
    pointsAwarded: number;
  }>;

  // Timing fields
  @Column({ name: 'start_time', type: 'timestamp', nullable: true })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date;

  @Column({ name: 'duration_ms', nullable: true })
  durationMs: number;

  @Column({ name: 'time_limit_ms', default: 30000 })
  timeLimitMs: number;

  // Scoring fields
  @Column({ name: 'max_points', default: 1000 })
  maxPoints: number;

  @Column({ name: 'points_awarded', default: 0 })
  pointsAwarded: number;

  @Column({ name: 'difficulty_multiplier', type: 'decimal', default: 1.0 })
  difficultyMultiplier: number;

  // Statistics
  @Column('jsonb', { default: {} })
  statistics: {
    totalPlayers: number;
    correctAnswers: number;
    averageResponseTime: number;
    fastestResponseTime: number;
    slowestResponseTime: number;
    accuracyRate: number;
  };

  // Replay data
  @Column('jsonb', { default: {} })
  replayData: {
    events: Array<{
      playerId: string;
      action: string;
      timestamp: Date;
      data: any;
    }>;
    interactions: Record<string, any>;
    performance: {
      renderTime: number;
      loadTime: number;
    };
  };

  // Additional metadata
  @Column('jsonb', { default: {} })
  metadata: {
    songInfo?: {
      title: string;
      artist: string;
      genre?: string;
      year?: number;
    };
    gameSettings?: Record<string, any>;
    customData?: Record<string, any>;
  };

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => GameSession, session => session.rounds, { 
    onDelete: 'CASCADE' 
  })
  @JoinColumn({ name: 'session_id' })
  session: GameSession;

  @ManyToOne(() => Song, { eager: false })
  @JoinColumn({ name: 'song_id' })
  song: Song;

  // Helper methods
  isActive(): boolean {
    return this.status === RoundStatus.ACTIVE;
  }

  isCompleted(): boolean {
    return this.status === RoundStatus.COMPLETED;
  }

  getRemainingTime(): number {
    if (!this.startTime) return this.timeLimitMs;
    const elapsed = Date.now() - this.startTime.getTime();
    return Math.max(0, this.timeLimitMs - elapsed);
  }

  calculatePoints(responseTime: number, isCorrect: boolean): number {
    if (!isCorrect) return 0;
    
    const timeBonus = Math.max(0, (this.timeLimitMs - responseTime) / this.timeLimitMs);
    const basePoints = this.maxPoints * this.difficultyMultiplier;
    return Math.round(basePoints * (0.5 + 0.5 * timeBonus));
  }

  addPlayerAnswer(
    playerId: string, 
    answer: string | number, 
    submittedAt: Date = new Date()
  ): void {
    const responseTime = this.startTime 
      ? submittedAt.getTime() - this.startTime.getTime()
      : 0;
    
    const isCorrect = this.checkAnswer(answer);
    const pointsAwarded = this.calculatePoints(responseTime, isCorrect);

    this.answers[playerId] = {
      answer,
      submittedAt,
      timeElapsed: responseTime,
      isCorrect,
      pointsAwarded,
    };
  }

  private checkAnswer(answer: string | number): boolean {
    if (Array.isArray(this.questionData.correctAnswer)) {
      return this.questionData.correctAnswer.includes(answer);
    }
    return this.questionData.correctAnswer === answer;
  }

  updateStatistics(): void {
    const answers = Object.values(this.answers);
    const correctAnswers = answers.filter(a => a.isCorrect);
    const responseTimes = answers.map(a => a.timeElapsed);

    this.statistics = {
      totalPlayers: answers.length,
      correctAnswers: correctAnswers.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length || 0,
      fastestResponseTime: Math.min(...responseTimes) || 0,
      slowestResponseTime: Math.max(...responseTimes) || 0,
      accuracyRate: answers.length ? correctAnswers.length / answers.length : 0,
    };
  }

  addReplayEvent(playerId: string, action: string, data: any): void {
    if (!this.replayData.events) {
      this.replayData.events = [];
    }
    
    this.replayData.events.push({
      playerId,
      action,
      timestamp: new Date(),
      data,
    });
  }
}