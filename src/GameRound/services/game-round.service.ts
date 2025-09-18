import { Injectable, Logger, NotFoundException, BadRequestException, OnModuleDestroy } from '@nestjs/common';
import { GameRoundRepository, CreateRoundDto } from '../game-round.repository';
import { RoundQuestionGeneratorService, QuestionGenerationOptions } from '../round-question-generator.service';
import { GameRound, QuestionType, RoundStatus } from '../entities/game-round.entity';
import { Song } from '../entities/song.entity';
import { GameSession } from '../entities/game-session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface CreateGameRoundDto {
  sessionId: string;
  songId: string;
  questionType?: QuestionType;
  difficulty?: 'easy' | 'medium' | 'hard';
  timeLimitMs?: number;
  maxPoints?: number;
  includeHints?: boolean;
  customSettings?: Record<string, any>;
}

export interface StartRoundDto {
  roundId: string;
  autoEnd?: boolean;
  timeExtension?: number; // milliseconds
}

export interface SubmitAnswerDto {
  roundId: string;
  playerId: string;
  answer: string | number;
  submittedAt?: Date;
}

export interface RoundResult {
  round: GameRound;
  playerResults: Array<{
    playerId: string;
    answer: string | number;
    isCorrect: boolean;
    pointsAwarded: number;
    responseTime: number;
    rank?: number;
  }>;
  statistics: {
    totalPlayers: number;
    correctAnswers: number;
    averageResponseTime: number;
    accuracyRate: number;
    fastestResponseTime: number;
    slowestResponseTime: number;
  };
}

export interface DifficultySettings {
  easy: {
    timeLimitMs: number;
    maxPoints: number;
    hintPenalty: number;
    partialCreditThreshold: number;
  };
  medium: {
    timeLimitMs: number;
    maxPoints: number;
    hintPenalty: number;
    partialCreditThreshold: number;
  };
  hard: {
    timeLimitMs: number;
    maxPoints: number;
    hintPenalty: number;
    partialCreditThreshold: number;
  };
}

@Injectable()
export class GameRoundService implements OnModuleDestroy {
  private readonly logger = new Logger(GameRoundService.name);
  private readonly autoEndTimeouts = new Map<string, NodeJS.Timeout>();
  
  private readonly difficultySettings: DifficultySettings = {
    easy: {
      timeLimitMs: 45000, // 45 seconds
      maxPoints: 1000,
      hintPenalty: 0.1, // 10% penalty
      partialCreditThreshold: 0.7, // 70% similarity for partial credit
    },
    medium: {
      timeLimitMs: 30000, // 30 seconds
      maxPoints: 1500,
      hintPenalty: 0.15, // 15% penalty
      partialCreditThreshold: 0.8, // 80% similarity for partial credit
    },
    hard: {
      timeLimitMs: 20000, // 20 seconds
      maxPoints: 2000,
      hintPenalty: 0.2, // 20% penalty
      partialCreditThreshold: 0.9, // 90% similarity for partial credit
    },
  };

  constructor(
    private readonly gameRoundRepository: GameRoundRepository,
    private readonly questionGenerator: RoundQuestionGeneratorService,
    @InjectRepository(Song)
    private readonly songRepository: Repository<Song>,
    @InjectRepository(GameSession)
    private readonly sessionRepository: Repository<GameSession>,
  ) {}

  /**
   * Create a new game round with automatic question generation
   */
  async createRound(dto: CreateGameRoundDto): Promise<GameRound> {
    this.logger.log(`Creating new round for session ${dto.sessionId}`);

    // Validate session exists and is active
    const session = await this.sessionRepository.findOne({
      where: { id: dto.sessionId },
    });
    
    if (!session) {
      throw new NotFoundException(`Game session ${dto.sessionId} not found`);
    }

    if (session.status !== 'active' && session.status !== 'waiting') {
      throw new BadRequestException('Cannot create round for inactive session');
    }

    // Validate song exists
    const song = await this.songRepository.findOne({
      where: { id: dto.songId },
    });
    
    if (!song) {
      throw new NotFoundException(`Song ${dto.songId} not found`);
    }

    // Determine question type if not specified
    const questionType = dto.questionType || this.selectQuestionType(dto.difficulty || 'medium');
    
    // Generate question with appropriate difficulty
    const questionOptions: QuestionGenerationOptions = {
      difficulty: dto.difficulty || 'medium',
      includeHints: dto.includeHints || false,
      customSettings: dto.customSettings,
    };

    const questionData = this.questionGenerator.generateQuestion(
      song,
      questionType,
      questionOptions
    );

    // Get difficulty settings
    const difficulty = dto.difficulty || 'medium';
    const settings = this.difficultySettings[difficulty];

    // Create round data
    const roundData: CreateRoundDto = {
      sessionId: dto.sessionId,
      songId: dto.songId,
      questionType,
      questionData,
      timeLimitMs: dto.timeLimitMs || settings.timeLimitMs,
      maxPoints: dto.maxPoints || settings.maxPoints,
      difficultyMultiplier: this.getDifficultyMultiplier(difficulty),
      metadata: {
        songInfo: {
          title: song.title,
          artist: song.artist,
          genre: song.genre,
          year: song.releaseYear,
        },
        gameSettings: {
          difficulty,
          includeHints: dto.includeHints,
          ...dto.customSettings,
        },
      },
    };

    const round = await this.gameRoundRepository.create(roundData);
    
    this.logger.log(`Created round ${round.id} for session ${dto.sessionId}`);
    return round;
  }

  /**
   * Start a round and begin timing
   */
  async startRound(dto: StartRoundDto): Promise<GameRound> {
    this.logger.log(`Starting round ${dto.roundId}`);

    const round = await this.gameRoundRepository.findById(dto.roundId);
    if (!round) {
      throw new NotFoundException(`Round ${dto.roundId} not found`);
    }

    if (round.status !== RoundStatus.PENDING) {
      throw new BadRequestException(`Cannot start round in ${round.status} status`);
    }

    // Apply time extension if provided
    if (dto.timeExtension && dto.timeExtension > 0) {
      round.timeLimitMs += dto.timeExtension;
    }

    const startedRound = await this.gameRoundRepository.startRound(dto.roundId);
    
    // Set up auto-end timer if requested
    if (dto.autoEnd !== false) {
      this.scheduleAutoEnd(dto.roundId, round.timeLimitMs);
    }

    this.logger.log(`Started round ${dto.roundId} with ${round.timeLimitMs}ms time limit`);
    return startedRound;
  }

  /**
   * Submit a player's answer
   */
  async submitAnswer(dto: SubmitAnswerDto): Promise<{
    isCorrect: boolean;
    pointsAwarded: number;
    responseTime: number;
    rank?: number;
  }> {
    this.logger.log(`Player ${dto.playerId} submitting answer for round ${dto.roundId}`);

    const round = await this.gameRoundRepository.findById(dto.roundId);
    if (!round) {
      throw new NotFoundException(`Round ${dto.roundId} not found`);
    }

    if (!round.isActive()) {
      throw new BadRequestException('Cannot submit answer to inactive round');
    }

    const submittedAt = dto.submittedAt || new Date();
    const responseTime = round.startTime 
      ? submittedAt.getTime() - round.startTime.getTime()
      : 0;

    // Check if time limit exceeded
    if (responseTime > round.timeLimitMs) {
      this.logger.warn(`Player ${dto.playerId} submitted answer after time limit`);
      // Still accept the answer but with penalty
    }

    // Validate and score the answer
    const difficulty = round.metadata.gameSettings?.difficulty || 'medium';
    const validationResult = this.validateAnswer(dto.answer, round.questionData, difficulty);
    const pointsAwarded = this.calculatePoints(
      responseTime,
      validationResult.isCorrect,
      validationResult.partialCredit,
      round,
      dto.playerId
    );

    // Save the answer
    await this.gameRoundRepository.savePlayerAnswer(
      dto.roundId,
      dto.playerId,
      dto.answer
    );

    // Calculate current rank if round is still active
    let rank: number | undefined;
    if (round.isActive()) {
      rank = await this.calculatePlayerRank(dto.roundId, dto.playerId);
    }

    this.logger.log(`Answer submitted: correct=${validationResult.isCorrect}, points=${pointsAwarded}`);
    
    return {
      isCorrect: validationResult.isCorrect,
      pointsAwarded,
      responseTime,
      rank,
    };
  }

  /**
   * End a round and calculate final results
   */
  async endRound(roundId: string): Promise<RoundResult> {
    this.logger.log(`Ending round ${roundId}`);

    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) {
      throw new NotFoundException(`Round ${roundId} not found`);
    }

    if (round.isCompleted()) {
      throw new BadRequestException('Round is already completed');
    }

    // End the round
    const completedRound = await this.gameRoundRepository.endRound(roundId);
    
    // Calculate player results with rankings
    const playerResults = await this.calculatePlayerResults(roundId);
    
    // Get updated statistics
    const statistics = completedRound.statistics;

    const result: RoundResult = {
      round: completedRound,
      playerResults,
      statistics,
    };

    this.logger.log(`Round ${roundId} ended with ${statistics.totalPlayers} players`);
    return result;
  }

  /**
   * Get round details
   */
  async getRound(roundId: string, includeAnswers: boolean = false): Promise<GameRound> {
    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) {
      throw new NotFoundException(`Round ${roundId} not found`);
    }

    // Remove answers if not requested
    if (!includeAnswers) {
      round.answers = {};
    }

    return round;
  }

  /**
   * Get all rounds for a session
   */
  async getSessionRounds(
    sessionId: string,
    options?: {
      status?: RoundStatus;
      includeAnswers?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<GameRound[]> {
    const rounds = await this.gameRoundRepository.findBySession(sessionId, {
      status: options?.status,
      includeRelations: true,
      orderBy: 'roundNumber',
      order: 'ASC',
    });

    // Apply pagination
    const startIndex = options?.offset || 0;
    const endIndex = options?.limit 
      ? startIndex + options.limit 
      : rounds.length;

    const paginatedRounds = rounds.slice(startIndex, endIndex);

    // Remove answers if not requested
    if (!options?.includeAnswers) {
      paginatedRounds.forEach(round => {
        round.answers = {};
      });
    }

    return paginatedRounds;
  }

  /**
   * Get round statistics
   */
  async getRoundStatistics(roundId: string): Promise<{
    round: GameRound;
    playerResults: Array<{
      playerId: string;
      isCorrect: boolean;
      pointsAwarded: number;
      responseTime: number;
      rank: number;
    }>;
    difficultyAnalysis: {
      expectedAccuracy: number;
      actualAccuracy: number;
      difficultyAdjustment: number;
    };
  }> {
    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) {
      throw new NotFoundException(`Round ${roundId} not found`);
    }

    const playerResults = await this.calculatePlayerResults(roundId);
    const difficultyAnalysis = this.analyzeDifficulty(round, playerResults);

    return {
      round,
      playerResults,
      difficultyAnalysis,
    };
  }

  /**
   * Extend round time
   */
  async extendRoundTime(
    roundId: string,
    extensionMs: number,
    reason?: string
  ): Promise<GameRound> {
    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) {
      throw new NotFoundException(`Round ${roundId} not found`);
    }

    if (!round.isActive()) {
      throw new BadRequestException('Cannot extend time for inactive round');
    }

    // Log the extension
    await this.gameRoundRepository.addReplayEvent(
      roundId,
      'system', // Use 'system' as playerId for system events
      'TIME_EXTENDED',
      { extensionMs, reason, newTimeLimit: round.timeLimitMs + extensionMs }
    );

    // Add extension time and update
    const updatedRound = await this.gameRoundRepository.updateRound(roundId, {
      timeLimitMs: round.timeLimitMs + extensionMs
    });

    this.logger.log(`Extended round ${roundId} by ${extensionMs}ms. Reason: ${reason || 'No reason provided'}`);
    return updatedRound;
  }

  /**
   * Skip a round
   */
  async skipRound(roundId: string, reason?: string): Promise<GameRound> {
    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) {
      throw new NotFoundException(`Round ${roundId} not found`);
    }

    if (round.isCompleted()) {
      throw new BadRequestException('Cannot skip completed round');
    }

    await this.gameRoundRepository.updateStatus(roundId, RoundStatus.SKIPPED);
    
    // Log the skip
    await this.gameRoundRepository.addReplayEvent(
      roundId,
      'system', // Use 'system' as playerId for system events
      'ROUND_SKIPPED',
      { reason }
    );

    this.logger.log(`Skipped round ${roundId}. Reason: ${reason || 'No reason provided'}`);
    return await this.gameRoundRepository.findById(roundId);
  }

  /**
   * Get active rounds across all sessions
   */
  async getActiveRounds(): Promise<GameRound[]> {
    return await this.gameRoundRepository.getActiveRounds();
  }

  /**
   * Calculate adaptive difficulty for next round
   */
  calculateAdaptiveDifficulty(
    sessionId: string,
    recentRounds: GameRound[],
    targetAccuracy: number = 0.7
  ): 'easy' | 'medium' | 'hard' {
    if (recentRounds.length === 0) {
      return 'medium'; // Default difficulty
    }

    // Calculate average accuracy from recent rounds
    const totalAccuracy = recentRounds.reduce((sum, round) => {
      return sum + (round.statistics.accuracyRate || 0);
    }, 0);
    
    const averageAccuracy = totalAccuracy / recentRounds.length;

    // Adjust difficulty based on accuracy
    if (averageAccuracy < targetAccuracy - 0.1) {
      return 'easy'; // Too hard, make it easier
    } else if (averageAccuracy > targetAccuracy + 0.1) {
      return 'hard'; // Too easy, make it harder
    } else {
      return 'medium'; // Just right
    }
  }

  // Private helper methods

  private selectQuestionType(difficulty: string): QuestionType {
    const typeDistribution = {
      easy: {
        [QuestionType.MULTIPLE_CHOICE]: 0.4,
        [QuestionType.TRUE_FALSE]: 0.3,
        [QuestionType.FILL_IN_BLANK]: 0.2,
        [QuestionType.AUDIO_CLIP]: 0.1,
        [QuestionType.LYRICS_GUESS]: 0.0,
      },
      medium: {
        [QuestionType.MULTIPLE_CHOICE]: 0.3,
        [QuestionType.TRUE_FALSE]: 0.2,
        [QuestionType.FILL_IN_BLANK]: 0.3,
        [QuestionType.AUDIO_CLIP]: 0.15,
        [QuestionType.LYRICS_GUESS]: 0.05,
      },
      hard: {
        [QuestionType.MULTIPLE_CHOICE]: 0.2,
        [QuestionType.TRUE_FALSE]: 0.1,
        [QuestionType.FILL_IN_BLANK]: 0.3,
        [QuestionType.AUDIO_CLIP]: 0.2,
        [QuestionType.LYRICS_GUESS]: 0.2,
      },
    };

    const distribution = typeDistribution[difficulty];
    const random = Math.random();
    let cumulative = 0;

    for (const [type, probability] of Object.entries(distribution)) {
      cumulative += probability as number;
      if (random <= cumulative) {
        return type as QuestionType;
      }
    }

    return QuestionType.MULTIPLE_CHOICE; // Fallback
  }

  private getDifficultyMultiplier(difficulty: string): number {
    const multipliers = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.3,
    };
    return multipliers[difficulty] || 1.0;
  }

  private validateAnswer(
    answer: string | number,
    questionData: any,
    difficulty: string = 'medium'
  ): { isCorrect: boolean; partialCredit: number; similarity?: number } {
    const correctAnswer = questionData.correctAnswer;
    
    // Exact match
    if (answer === correctAnswer) {
      return { isCorrect: true, partialCredit: 1.0 };
    }

    // String similarity check for text answers
    if (typeof answer === 'string' && typeof correctAnswer === 'string') {
      const similarity = this.calculateStringSimilarity(
        answer.toLowerCase().trim(),
        correctAnswer.toLowerCase().trim()
      );
      
      // Check for partial credit threshold
      const settings = this.difficultySettings[difficulty] || this.difficultySettings.medium;
      const threshold = settings.partialCreditThreshold;
      
      if (similarity >= threshold) {
        return { isCorrect: true, partialCredit: similarity, similarity };
      }
    }

    // Check for array of correct answers
    if (Array.isArray(correctAnswer)) {
      const isCorrect = correctAnswer.includes(answer);
      return { isCorrect, partialCredit: isCorrect ? 1.0 : 0.0 };
    }

    return { isCorrect: false, partialCredit: 0.0 };
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength === 0 ? 1.0 : (maxLength - distance) / maxLength;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null)
    );

    for (let i = 0; i <= str1.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  private calculatePoints(
    responseTime: number,
    isCorrect: boolean,
    partialCredit: number,
    round: GameRound,
    playerId: string
  ): number {
    if (!isCorrect) return 0;

    // Base points from round settings
    let points = round.maxPoints * round.difficultyMultiplier;

    // Apply partial credit
    points *= partialCredit;

    // Time bonus calculation
    const timeBonus = Math.max(0, (round.timeLimitMs - responseTime) / round.timeLimitMs);
    points *= (0.5 + 0.5 * timeBonus);

    // Hint penalty (if applicable)
    const hintPenalty = this.getHintPenalty(round, playerId);
    points *= (1 - hintPenalty);

    return Math.round(points);
  }

  private getHintPenalty(round: GameRound, playerId: string): number {
    // Check if player used hints (this would need to be tracked in replay data)
    const hintEvents = round.replayData.events?.filter(
      event => event.playerId === playerId && event.action === 'HINT_USED'
    ) || [];

    const difficulty = round.metadata.gameSettings?.difficulty || 'medium';
    const penaltyPerHint = this.difficultySettings[difficulty].hintPenalty;
    
    return hintEvents.length * penaltyPerHint;
  }

  private async calculatePlayerRank(roundId: string, playerId: string): Promise<number> {
    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) return 0;

    const answers = Object.entries(round.answers);
    
    // Sort by points awarded (descending), then by response time (ascending)
    const sortedAnswers = answers.sort(([, a], [, b]) => {
      if (b.pointsAwarded !== a.pointsAwarded) {
        return b.pointsAwarded - a.pointsAwarded;
      }
      return a.timeElapsed - b.timeElapsed;
    });

    const playerIndex = sortedAnswers.findIndex(([id]) => id === playerId);
    return playerIndex >= 0 ? playerIndex + 1 : answers.length + 1;
  }

  private async calculatePlayerResults(roundId: string): Promise<Array<{
    playerId: string;
    answer: string | number;
    isCorrect: boolean;
    pointsAwarded: number;
    responseTime: number;
    rank: number;
  }>> {
    const round = await this.gameRoundRepository.findById(roundId);
    if (!round) return [];

    const answers = Object.entries(round.answers);
    
    // Sort by points awarded (descending), then by response time (ascending)
    const sortedAnswers = answers.sort(([, a], [, b]) => {
      if (b.pointsAwarded !== a.pointsAwarded) {
        return b.pointsAwarded - a.pointsAwarded;
      }
      return a.timeElapsed - b.timeElapsed;
    });

    return sortedAnswers.map(([playerId, answerData], index) => ({
      playerId,
      answer: answerData.answer,
      isCorrect: answerData.isCorrect,
      pointsAwarded: answerData.pointsAwarded,
      responseTime: answerData.timeElapsed,
      rank: index + 1,
    }));
  }

  private analyzeDifficulty(round: GameRound, playerResults: any[]): {
    expectedAccuracy: number;
    actualAccuracy: number;
    difficultyAdjustment: number;
  } {
    const difficulty = round.metadata.gameSettings?.difficulty || 'medium';
    const actualAccuracy = round.statistics.accuracyRate;
    
    // Expected accuracy based on difficulty
    const expectedAccuracy = {
      easy: 0.8,
      medium: 0.7,
      hard: 0.6,
    }[difficulty] || 0.7;

    // Calculate adjustment needed
    const accuracyDifference = actualAccuracy - expectedAccuracy;
    const difficultyAdjustment = Math.max(-1, Math.min(1, accuracyDifference * 2));

    return {
      expectedAccuracy,
      actualAccuracy,
      difficultyAdjustment,
    };
  }

  private scheduleAutoEnd(roundId: string, timeLimitMs: number): string {
    // Cancel existing timeout if any
    this.cancelAutoEnd(roundId);
    
    const timeoutId = setTimeout(async () => {
      try {
        const round = await this.gameRoundRepository.findById(roundId);
        if (round && round.isActive()) {
          this.logger.log(`Auto-ending round ${roundId} after ${timeLimitMs}ms`);
          await this.endRound(roundId);
        }
      } catch (error) {
        this.logger.error(`Error auto-ending round ${roundId}:`, error);
      }
    }, timeLimitMs);
    
    this.autoEndTimeouts.set(roundId, timeoutId);
    this.logger.log(`Scheduled auto-end for round ${roundId} in ${timeLimitMs}ms`);
    return roundId;
  }

  /**
   * Cancel the auto-end timeout for a round
   */
  cancelAutoEnd(roundId: string): boolean {
    const timeoutId = this.autoEndTimeouts.get(roundId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.autoEndTimeouts.delete(roundId);
      this.logger.log(`Cancelled auto-end timeout for round ${roundId}`);
      return true;
    }
    return false;
  }

  /**
   * Get scheduled auto-end timeouts for monitoring
   */
  getScheduledAutoEndTimeouts(): Array<{ roundId: string; hasTimeout: boolean }> {
    return Array.from(this.autoEndTimeouts.keys()).map(roundId => ({
      roundId,
      hasTimeout: true,
    }));
  }

  /**
   * Graceful shutdown - cancel all pending auto-end timeouts
   */
  async onModuleDestroy(): Promise<void> {
    this.logger.log('Shutting down GameRoundService...');
    
    try {
      // Clear all timeouts
      for (const [roundId, timeoutId] of this.autoEndTimeouts) {
        clearTimeout(timeoutId);
        this.logger.log(`Cleared auto-end timeout for round ${roundId}`);
      }
      this.autoEndTimeouts.clear();
      
      this.logger.log(`Cleared ${this.autoEndTimeouts.size} auto-end timeouts`);
    } catch (error) {
      this.logger.error('Error during GameRoundService shutdown:', error);
    }
  }
}
