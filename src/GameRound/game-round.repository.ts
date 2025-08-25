import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindManyOptions, FindOneOptions } from 'typeorm';
import { GameRound, QuestionType, RoundStatus } from './entities/game-round.entity';

export interface CreateRoundDto {
  sessionId: string;
  songId: string;
  questionType: QuestionType;
  questionData: any;
  timeLimitMs?: number;
  maxPoints?: number;
  difficultyMultiplier?: number;
  metadata?: any;
}

export interface RoundFilters {
  sessionId?: string;
  status?: RoundStatus;
  questionType?: QuestionType;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
}

@Injectable()
export class GameRoundRepository {
  constructor(
    @InjectRepository(GameRound)
    private readonly repository: Repository<GameRound>,
  ) {}

  async create(data: CreateRoundDto): Promise<GameRound> {
    // Get the next round number for the session
    const roundNumber = await this.getNextRoundNumber(data.sessionId);
    
    const round = this.repository.create({
      ...data,
      roundNumber,
      status: RoundStatus.PENDING,
      statistics: {
        totalPlayers: 0,
        correctAnswers: 0,
        averageResponseTime: 0,
        fastestResponseTime: 0,
        slowestResponseTime: 0,
        accuracyRate: 0,
      },
      replayData: {
        events: [],
        interactions: {},
        performance: { renderTime: 0, loadTime: 0 },
      },
    });

    return await this.repository.save(round);
  }

  async findById(id: string, relations?: string[]): Promise<GameRound | null> {
    const options: FindOneOptions<GameRound> = { where: { id } };
    if (relations) {
      options.relations = relations;
    }
    return await this.repository.findOne(options);
  }

  async findBySession(
    sessionId: string, 
    options?: { 
      status?: RoundStatus; 
      includeRelations?: boolean;
      orderBy?: 'roundNumber' | 'createdAt';
      order?: 'ASC' | 'DESC';
    }
  ): Promise<GameRound[]> {
    const queryOptions: FindManyOptions<GameRound> = {
      where: { sessionId },
      order: {},
    };

    if (options?.status) {
      queryOptions.where = { ...queryOptions.where, status: options.status };
    }

    if (options?.includeRelations) {
      queryOptions.relations = ['song', 'session'];
    }

    const orderBy = options?.orderBy || 'roundNumber';
    const order = options?.order || 'ASC';
    queryOptions.order[orderBy] = order;

    return await this.repository.find(queryOptions);
  }

  async findWithFilters(filters: RoundFilters): Promise<GameRound[]> {
    const queryBuilder = this.repository.createQueryBuilder('round');

    if (filters.sessionId) {
      queryBuilder.andWhere('round.sessionId = :sessionId', { 
        sessionId: filters.sessionId 
      });
    }

    if (filters.status) {
      queryBuilder.andWhere('round.status = :status', { 
        status: filters.status 
      });
    }

    if (filters.questionType) {
      queryBuilder.andWhere('round.questionType = :questionType', { 
        questionType: filters.questionType 
      });
    }

    if (filters.dateFrom) {
      queryBuilder.andWhere('round.createdAt >= :dateFrom', { 
        dateFrom: filters.dateFrom 
      });
    }

    if (filters.dateTo) {
      queryBuilder.andWhere('round.createdAt <= :dateTo', { 
        dateTo: filters.dateTo 
      });
    }

    queryBuilder.orderBy('round.createdAt', 'DESC');

    if (filters.limit) {
      queryBuilder.limit(filters.limit);
    }

    if (filters.offset) {
      queryBuilder.offset(filters.offset);
    }

    return await queryBuilder.getMany();
  }

  async updateStatus(id: string, status: RoundStatus): Promise<GameRound | null> {
    await this.repository.update(id, { status });
    return await this.findById(id);
  }

  async startRound(id: string): Promise<GameRound | null> {
    const startTime = new Date();
    await this.repository.update(id, { 
      status: RoundStatus.ACTIVE, 
      startTime 
    });
    return await this.findById(id);
  }

  async endRound(id: string): Promise<GameRound | null> {
    const round = await this.findById(id);
    if (!round) return null;

    const endTime = new Date();
    const durationMs = round.startTime 
      ? endTime.getTime() - round.startTime.getTime() 
      : 0;

    // Calculate total points awarded
    const pointsAwarded = Object.values(round.answers)
      .reduce((sum, answer) => sum + answer.pointsAwarded, 0);

    // Update statistics
    round.updateStatistics();

    await this.repository.update(id, {
      status: RoundStatus.COMPLETED,
      endTime,
      durationMs,
      pointsAwarded,
      statistics: round.statistics,
    });

    return await this.findById(id);
  }

  async savePlayerAnswer(
    roundId: string, 
    playerId: string, 
    answer: string | number
  ): Promise<GameRound | null> {
    const round = await this.findById(roundId);
    if (!round || !round.isActive()) return null;

    round.addPlayerAnswer(playerId, answer);
    await this.repository.save(round);
    return round;
  }

  async addReplayEvent(
    roundId: string, 
    playerId: string, 
    action: string, 
    data: any
  ): Promise<void> {
    const round = await this.findById(roundId);
    if (!round) return;

    round.addReplayEvent(playerId, action, data);
    await this.repository.save(round);
  }

  async getSessionStatistics(sessionId: string): Promise<{
    totalRounds: number;
    completedRounds: number;
    averageAccuracy: number;
    averageResponseTime: number;
    totalPointsAwarded: number;
  }> {
    const rounds = await this.findBySession(sessionId);
    const completedRounds = rounds.filter(r => r.isCompleted());
    
    const totalAccuracy = completedRounds.reduce((sum, r) => 
      sum + r.statistics.accuracyRate, 0
    );
    
    const totalResponseTime = completedRounds.reduce((sum, r) => 
      sum + r.statistics.averageResponseTime, 0
    );
    
    const totalPointsAwarded = completedRounds.reduce((sum, r) => 
      sum + r.pointsAwarded, 0
    );

    return {
      totalRounds: rounds.length,
      completedRounds: completedRounds.length,
      averageAccuracy: completedRounds.length ? totalAccuracy / completedRounds.length : 0,
      averageResponseTime: completedRounds.length ? totalResponseTime / completedRounds.length : 0,
      totalPointsAwarded,
    };
  }

  private async getNextRoundNumber(sessionId: string): Promise<number> {
    const lastRound = await this.repository.findOne({
      where: { sessionId },
      order: { roundNumber: 'DESC' },
    });

    return lastRound ? lastRound.roundNumber + 1 : 1;
  }

  async bulkCreate(rounds: CreateRoundDto[]): Promise<GameRound[]> {
    const entities = await Promise.all(
      rounds.map(async (data) => {
        const roundNumber = await this.getNextRoundNumber(data.sessionId);
        return this.repository.create({
          ...data,
          roundNumber,
          status: RoundStatus.PENDING,
        });
      })
    );

    return await this.repository.save(entities);
  }

  async deleteBySession(sessionId: string): Promise<void> {
    await this.repository.delete({ sessionId });
  }

  async getActiveRounds(): Promise<GameRound[]> {
    return await this.repository.find({
      where: { status: RoundStatus.ACTIVE },
      relations: ['session'],
    });
  }
}