import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, QueryRunner } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { Match } from '../entities/match.entity';
import { MatchResult } from '../entities/match-result.entity';
import { Bracket } from '../entities/bracket.entity';
import { PrizeDistribution } from '../entities/prize-distribution.entity';
import { TournamentEvent } from '../entities/tournament-event.entity';
import { BracketGeneratorService } from '../algorithms/bracket-generator.service';
import { SeedingService } from '../algorithms/seeding.service';
import { TournamentCacheService } from './tournament-cache.service';
import { TournamentEligibilityService } from './tournament-eligibility.service';
import { PrizeCalculatorService } from './prize-calculator.service';
import {
  TournamentFormat,
  TournamentStatus,
  ParticipantStatus,
  MatchStatus,
  TournamentEventType,
} from '../enums/tournament.enums';
import {
  ITournamentParticipant,
  IMatchResult,
  IBracketStructure,
} from '../interfaces/tournament.interfaces';

@Injectable()
export class TournamentService {
  constructor(
    @InjectRepository(Tournament)
    private tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentParticipant)
    private participantRepository: Repository<TournamentParticipant>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(MatchResult)
    private matchResultRepository: Repository<MatchResult>,
    @InjectRepository(Bracket)
    private bracketRepository: Repository<Bracket>,
    @InjectRepository(PrizeDistribution)
    private prizeRepository: Repository<PrizeDistribution>,
    @InjectRepository(TournamentEvent)
    private eventRepository: Repository<TournamentEvent>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private bracketGenerator: BracketGeneratorService,
    private seedingService: SeedingService,
    private cacheService: TournamentCacheService,
    private eligibilityService: TournamentEligibilityService,
    private prizeCalculator: PrizeCalculatorService,
  ) {}

  async createTournament(
    tournamentData: Partial<Tournament>,
  ): Promise<Tournament> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate tournament data
      this.validateTournamentData(tournamentData);

      const tournament = this.tournamentRepository.create(tournamentData);
      const savedTournament = await queryRunner.manager.save(tournament);

      // Create tournament event
      await this.createTournamentEvent(
        queryRunner,
        savedTournament.id,
        TournamentEventType.TOURNAMENT_CREATED,
        { tournament: savedTournament },
      );

      await queryRunner.commitTransaction();

      // Emit event
      this.eventEmitter.emit('tournament.created', savedTournament);

      // Cache tournament
      await this.cacheService.cacheTournament(savedTournament);

      return savedTournament;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async registerParticipant(
    tournamentId: string,
    playerId: string,
    teamId?: string,
  ): Promise<TournamentParticipant> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check tournament exists and is accepting registrations
      const tournament = await this.findTournamentById(tournamentId);
      if (!tournament.canRegister) {
        throw new BadRequestException('Tournament registration is not open');
      }

      // Check if tournament is full
      if (tournament.isFull) {
        throw new BadRequestException('Tournament is full');
      }

      // Check eligibility
      const isEligible = await this.eligibilityService.isEligible(
        playerId,
        tournamentId,
      );
      if (!isEligible) {
        const reason = await this.eligibilityService.getEligibilityReason(
          playerId,
          tournamentId,
        );
        throw new BadRequestException(`Player is not eligible: ${reason}`);
      }

      // Check if already registered
      const existingParticipant = await this.participantRepository.findOne({
        where: { tournamentId, playerId },
      });

      if (existingParticipant) {
        throw new ConflictException(
          'Player is already registered for this tournament',
        );
      }

      // Create participant
      const participant = this.participantRepository.create({
        tournamentId,
        playerId,
        teamId,
        status: tournament.requireApproval
          ? ParticipantStatus.REGISTERED
          : ParticipantStatus.CONFIRMED,
      });

      const savedParticipant = await queryRunner.manager.save(participant);

      // Create event
      await this.createTournamentEvent(
        queryRunner,
        tournamentId,
        TournamentEventType.PARTICIPANT_REGISTERED,
        { participant: savedParticipant },
      );

      await queryRunner.commitTransaction();

      // Emit event
      this.eventEmitter.emit('tournament.participant.registered', {
        tournament,
        participant: savedParticipant,
      });

      // Invalidate cache
      await this.cacheService.invalidateTournament(tournamentId);

      return savedParticipant;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async startTournament(tournamentId: string): Promise<Tournament> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tournament =
        await this.findTournamentWithParticipants(tournamentId);

      // Validate tournament can start
      if (tournament.status !== TournamentStatus.REGISTRATION_CLOSED) {
        throw new BadRequestException(
          'Tournament registration must be closed before starting',
        );
      }

      if (tournament.participantCount < tournament.minParticipants) {
        throw new BadRequestException(
          `Tournament needs at least ${tournament.minParticipants} participants`,
        );
      }

      // Generate bracket
      const activeParticipants = tournament.participants.filter(
        (p) =>
          p.status === ParticipantStatus.CONFIRMED ||
          p.status === ParticipantStatus.ACTIVE,
      );

      // Seed participants
      const seededParticipants = this.seedingService.generateSeeds(
        activeParticipants as ITournamentParticipant[],
      );

      // Generate bracket structure
      const bracketStructure = this.bracketGenerator.generateBracket(
        seededParticipants,
        tournament.format,
      );

      // Save bracket and matches
      await this.saveBracketStructure(
        queryRunner,
        tournament.id,
        bracketStructure,
      );

      // Update tournament status
      tournament.status = TournamentStatus.IN_PROGRESS;
      await queryRunner.manager.save(tournament);

      // Update participant statuses
      await queryRunner.manager.update(
        TournamentParticipant,
        { tournamentId, status: ParticipantStatus.CONFIRMED },
        { status: ParticipantStatus.ACTIVE },
      );

      // Create event
      await this.createTournamentEvent(
        queryRunner,
        tournamentId,
        TournamentEventType.TOURNAMENT_STARTED,
        { tournament, bracket: bracketStructure },
      );

      await queryRunner.commitTransaction();

      // Emit event
      this.eventEmitter.emit('tournament.started', tournament);

      // Cache updated tournament state
      await this.cacheService.cacheTournamentState(tournamentId, {
        tournamentId,
        currentRound: 1,
        activeMatches:
          bracketStructure.rounds[0]?.matches.map((m) => m.id) || [],
        completedMatches: [],
        bracket: bracketStructure,
        lastUpdated: new Date(),
      });

      return tournament;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async recordMatchResult(
    matchId: string,
    result: IMatchResult,
  ): Promise<Match> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const match = await this.matchRepository.findOne({
        where: { id: matchId },
        relations: ['tournament', 'homeParticipant', 'awayParticipant'],
      });

      if (!match) {
        throw new NotFoundException('Match not found');
      }

      if (match.status === MatchStatus.COMPLETED) {
        throw new BadRequestException('Match is already completed');
      }

      // Update match
      match.homeScore = result.homeScore;
      match.awayScore = result.awayScore;
      match.winnerId = result.winnerId;
      match.isDraw = result.isDraw || false;
      match.status = MatchStatus.COMPLETED;
      match.completedAt = new Date();

      await queryRunner.manager.save(match);

      // Save match results
      if (match.homeParticipant) {
        const homeResult = this.matchResultRepository.create({
          matchId,
          participantId: match.homeParticipant.id,
          score: result.homeScore,
          performance: result.metadata?.homePerformance,
        });
        await queryRunner.manager.save(homeResult);
      }

      if (match.awayParticipant) {
        const awayResult = this.matchResultRepository.create({
          matchId,
          participantId: match.awayParticipant.id,
          score: result.awayScore,
          performance: result.metadata?.awayPerformance,
        });
        await queryRunner.manager.save(awayResult);
      }

      // Update participant statistics
      await this.updateParticipantStats(queryRunner, match, result);

      // Check if tournament round/tournament is complete
      await this.checkRoundCompletion(queryRunner, match.tournament);

      // Create event
      await this.createTournamentEvent(
        queryRunner,
        match.tournamentId,
        TournamentEventType.MATCH_COMPLETED,
        { match, result },
      );

      await queryRunner.commitTransaction();

      // Emit event
      this.eventEmitter.emit('tournament.match.completed', { match, result });

      // Update tournament state cache
      await this.updateTournamentStateCache(match.tournamentId);

      return match;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getTournament(id: string): Promise<Tournament> {
    // Try cache first
    const cached = await this.cacheService.getTournament(id);
    if (cached) {
      return cached;
    }

    const tournament = await this.findTournamentWithParticipants(id);

    // Cache for future requests
    await this.cacheService.cacheTournament(tournament);

    return tournament;
  }

  async getTournamentBracket(
    tournamentId: string,
  ): Promise<IBracketStructure | null> {
    const cached = await this.cacheService.getTournamentState(tournamentId);
    if (cached?.bracket) {
      return cached.bracket;
    }

    // Rebuild bracket from database
    const matches = await this.matchRepository.find({
      where: { tournamentId },
      relations: ['homeParticipant', 'awayParticipant'],
      order: { round: 'ASC', matchNumber: 'ASC' },
    });

    if (matches.length === 0) {
      return null;
    }

    // Convert matches back to bracket structure
    // This is a simplified version - full implementation would be more complex
    return this.rebuildBracketFromMatches(matches);
  }

  async getActiveMatches(tournamentId: string): Promise<Match[]> {
    return this.matchRepository.find({
      where: {
        tournamentId,
        status: MatchStatus.IN_PROGRESS,
      },
      relations: ['homeParticipant', 'awayParticipant'],
    });
  }

  async getLeaderboard(tournamentId: string): Promise<TournamentParticipant[]> {
    return this.participantRepository.find({
      where: { tournamentId },
      order: {
        currentRank: 'ASC',
        points: 'DESC',
        wins: 'DESC',
      },
    });
  }

  async eliminateParticipant(
    participantId: string,
    round: number,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const participant = await this.participantRepository.findOne({
        where: { id: participantId },
        relations: ['tournament'],
      });

      if (!participant) {
        throw new NotFoundException('Participant not found');
      }

      participant.status = ParticipantStatus.ELIMINATED;
      participant.eliminatedAt = new Date();
      participant.eliminatedInRound = round;

      await queryRunner.manager.save(participant);

      // Create event
      await this.createTournamentEvent(
        queryRunner,
        participant.tournamentId,
        TournamentEventType.PARTICIPANT_ELIMINATED,
        { participant, round },
      );

      await queryRunner.commitTransaction();

      // Emit event
      this.eventEmitter.emit('tournament.participant.eliminated', participant);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private validateTournamentData(data: Partial<Tournament>): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new BadRequestException('Tournament name is required');
    }

    if (
      !data.format ||
      !Object.values(TournamentFormat).includes(data.format)
    ) {
      throw new BadRequestException('Valid tournament format is required');
    }

    if (data.maxParticipants && data.maxParticipants < 2) {
      throw new BadRequestException(
        'Tournament must allow at least 2 participants',
      );
    }

    if (data.registrationStartAt && data.registrationEndAt) {
      if (data.registrationStartAt >= data.registrationEndAt) {
        throw new BadRequestException(
          'Registration start date must be before end date',
        );
      }
    }

    if (data.registrationEndAt && data.startAt) {
      if (data.registrationEndAt > data.startAt) {
        throw new BadRequestException(
          'Registration must end before tournament starts',
        );
      }
    }
  }

  private async findTournamentById(id: string): Promise<Tournament> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return tournament;
  }

  private async findTournamentWithParticipants(
    id: string,
  ): Promise<Tournament> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id },
      relations: ['participants'],
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return tournament;
  }

  private async saveBracketStructure(
    queryRunner: QueryRunner,
    tournamentId: string,
    bracket: IBracketStructure,
  ): Promise<void> {
    // Save matches from bracket structure
    for (const round of bracket.rounds) {
      for (const bracketMatch of round.matches) {
        const match = this.matchRepository.create({
          id: bracketMatch.id,
          tournamentId,
          round: bracketMatch.round,
          matchNumber: bracketMatch.matchNumber,
          homeParticipantId: bracketMatch.homeParticipantId,
          awayParticipantId: bracketMatch.awayParticipantId,
          status: bracketMatch.status,
        });

        await queryRunner.manager.save(match);
      }
    }
  }

  private async updateParticipantStats(
    queryRunner: QueryRunner,
    match: Match,
    result: IMatchResult,
  ): Promise<void> {
    if (match.homeParticipant) {
      const homeParticipant = match.homeParticipant;
      if (result.winnerId === homeParticipant.id) {
        homeParticipant.wins++;
        homeParticipant.points += 3; // 3 points for win
      } else if (result.isDraw) {
        homeParticipant.draws++;
        homeParticipant.points += 1; // 1 point for draw
      } else {
        homeParticipant.losses++;
      }
      await queryRunner.manager.save(homeParticipant);
    }

    if (match.awayParticipant) {
      const awayParticipant = match.awayParticipant;
      if (result.winnerId === awayParticipant.id) {
        awayParticipant.wins++;
        awayParticipant.points += 3;
      } else if (result.isDraw) {
        awayParticipant.draws++;
        awayParticipant.points += 1;
      } else {
        awayParticipant.losses++;
      }
      await queryRunner.manager.save(awayParticipant);
    }
  }

  private async checkRoundCompletion(
    queryRunner: QueryRunner,
    tournament: Tournament,
  ): Promise<void> {
    // Check if current round is complete
    const currentRound = await this.getCurrentRound(tournament.id);
    const roundMatches = await this.matchRepository.find({
      where: { tournamentId: tournament.id, round: currentRound },
    });

    const completedMatches = roundMatches.filter(
      (m) => m.status === MatchStatus.COMPLETED,
    );

    if (completedMatches.length === roundMatches.length) {
      // Round is complete
      await this.createTournamentEvent(
        queryRunner,
        tournament.id,
        TournamentEventType.ROUND_COMPLETED,
        { round: currentRound, tournament },
      );

      // Check if tournament is complete
      const hasMoreRounds = await this.hasMoreRounds(
        tournament.id,
        currentRound,
      );
      if (!hasMoreRounds) {
        await this.completeTournament(queryRunner, tournament);
      }
    }
  }

  private async completeTournament(
    queryRunner: QueryRunner,
    tournament: Tournament,
  ): Promise<void> {
    tournament.status = TournamentStatus.COMPLETED;
    tournament.endAt = new Date();
    await queryRunner.manager.save(tournament);

    // Calculate final rankings
    await this.calculateFinalRankings(queryRunner, tournament.id);

    // Distribute prizes
    await this.distributePrizes(queryRunner, tournament);

    // Create event
    await this.createTournamentEvent(
      queryRunner,
      tournament.id,
      TournamentEventType.TOURNAMENT_COMPLETED,
      { tournament },
    );
  }

  private async calculateFinalRankings(
    queryRunner: QueryRunner,
    tournamentId: string,
  ): Promise<void> {
    const participants = await this.participantRepository.find({
      where: { tournamentId },
      order: { points: 'DESC', wins: 'DESC', losses: 'ASC' },
    });

    for (let i = 0; i < participants.length; i++) {
      participants[i].currentRank = i + 1;
      await queryRunner.manager.save(participants[i]);
    }
  }

  private async distributePrizes(
    queryRunner: QueryRunner,
    tournament: Tournament,
  ): Promise<void> {
    const participants = await this.participantRepository.find({
      where: { tournamentId: tournament.id },
      order: { currentRank: 'ASC' },
    });

    const prizeDistributions = this.prizeCalculator.calculatePrizes(
      tournament as any,
      participants as ITournamentParticipant[],
    );

    for (const prize of prizeDistributions) {
      const participant = participants.find(
        (p) => p.currentRank === prize.rank,
      );
      if (participant) {
        const prizeEntity = this.prizeRepository.create({
          tournamentId: tournament.id,
          rank: prize.rank,
          prizeAmount: prize.prizeAmount,
          prizeType: prize.prizeType as any,
          prizeData: prize.prizeData,
          winnerId: participant.id,
          distributedAt: new Date(),
        });

        await queryRunner.manager.save(prizeEntity);

        // Create event
        await this.createTournamentEvent(
          queryRunner,
          tournament.id,
          TournamentEventType.PRIZE_DISTRIBUTED,
          { prize: prizeEntity, participant },
        );
      }
    }
  }

  private async createTournamentEvent(
    queryRunner: QueryRunner,
    tournamentId: string,
    eventType: TournamentEventType,
    eventData: any,
  ): Promise<void> {
    const event = this.eventRepository.create({
      tournamentId,
      eventType,
      eventData,
    });

    await queryRunner.manager.save(event);
  }

  private async getCurrentRound(tournamentId: string): Promise<number> {
    const result = await this.matchRepository
      .createQueryBuilder('match')
      .select('MAX(match.round)', 'maxRound')
      .where('match.tournamentId = :tournamentId', { tournamentId })
      .andWhere('match.status != :status', { status: MatchStatus.COMPLETED })
      .getRawOne();

    return result?.maxRound || 1;
  }

  private async hasMoreRounds(
    tournamentId: string,
    currentRound: number,
  ): Promise<boolean> {
    const remainingMatches = await this.matchRepository.count({
      where: {
        tournamentId,
        round: currentRound + 1,
      },
    });

    return remainingMatches > 0;
  }

  private async updateTournamentStateCache(
    tournamentId: string,
  ): Promise<void> {
    const matches = await this.matchRepository.find({
      where: { tournamentId },
      order: { round: 'ASC', matchNumber: 'ASC' },
    });

    const activeMatches = matches.filter(
      (m) => m.status === MatchStatus.IN_PROGRESS,
    );
    const completedMatches = matches.filter(
      (m) => m.status === MatchStatus.COMPLETED,
    );

    await this.cacheService.updateTournamentState(tournamentId, {
      activeMatches: activeMatches.map((m) => m.id),
      completedMatches: completedMatches.map((m) => m.id),
      lastUpdated: new Date(),
    });
  }

  private rebuildBracketFromMatches(matches: Match[]): IBracketStructure {
    // Simplified implementation - would need more complex logic for full reconstruction
    const rounds: any[] = [];
    const maxRound = Math.max(...matches.map((m) => m.round));

    for (let roundNum = 1; roundNum <= maxRound; roundNum++) {
      const roundMatches = matches.filter((m) => m.round === roundNum);
      rounds.push({
        roundNumber: roundNum,
        matches: roundMatches.map((m) => ({
          id: m.id,
          round: m.round,
          matchNumber: m.matchNumber,
          homeParticipantId: m.homeParticipantId,
          awayParticipantId: m.awayParticipantId,
          winnerId: m.winnerId,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
          status: m.status,
        })),
        isCompleted: roundMatches.every(
          (m) => m.status === MatchStatus.COMPLETED,
        ),
      });
    }

    return {
      format: TournamentFormat.SINGLE_ELIMINATION, // Would need to determine actual format
      rounds,
      totalRounds: maxRound,
    };
  }

  async getTournaments(
    query: any,
  ): Promise<{ data: Tournament[]; total: number }> {
    const {
      page = 1,
      limit = 20,
      search,
      format,
      status,
      isPublic,
      createdBy,
      startAfter,
      startBefore,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = query;

    const queryBuilder = this.tournamentRepository
      .createQueryBuilder('tournament')
      .leftJoinAndSelect('tournament.participants', 'participants');

    // Apply filters
    if (search) {
      queryBuilder.andWhere('tournament.name ILIKE :search', {
        search: `%${search}%`,
      });
    }

    if (format) {
      queryBuilder.andWhere('tournament.format = :format', { format });
    }

    if (status) {
      queryBuilder.andWhere('tournament.status = :status', { status });
    }

    if (isPublic !== undefined) {
      queryBuilder.andWhere('tournament.isPublic = :isPublic', { isPublic });
    }

    if (createdBy) {
      queryBuilder.andWhere('tournament.createdBy = :createdBy', { createdBy });
    }

    if (startAfter) {
      queryBuilder.andWhere('tournament.startAt >= :startAfter', {
        startAfter: new Date(startAfter),
      });
    }

    if (startBefore) {
      queryBuilder.andWhere('tournament.startAt <= :startBefore', {
        startBefore: new Date(startBefore),
      });
    }

    // Apply sorting
    queryBuilder.orderBy(`tournament.${sortBy}`, sortOrder);

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  async updateTournament(
    id: string,
    updateData: Partial<Tournament>,
  ): Promise<Tournament> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tournament = await this.findTournamentById(id);

      // Validate update is allowed
      if (tournament.status === TournamentStatus.COMPLETED) {
        throw new BadRequestException('Cannot update completed tournament');
      }

      // Update tournament
      Object.assign(tournament, updateData);
      const updatedTournament = await queryRunner.manager.save(tournament);

      // Create event
      await this.createTournamentEvent(
        queryRunner,
        id,
        TournamentEventType.TOURNAMENT_UPDATED,
        { tournament: updatedTournament, updates: updateData },
      );

      await queryRunner.commitTransaction();

      // Invalidate cache
      await this.cacheService.invalidateTournament(id);

      // Emit event
      this.eventEmitter.emit('tournament.updated', updatedTournament);

      return updatedTournament;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async deleteTournament(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tournament = await this.findTournamentById(id);

      // Only allow deletion if tournament hasn't started
      if (
        tournament.status !== TournamentStatus.DRAFT &&
        tournament.status !== TournamentStatus.REGISTRATION_OPEN &&
        tournament.status !== TournamentStatus.REGISTRATION_CLOSED
      ) {
        throw new BadRequestException(
          'Cannot delete tournament that has started',
        );
      }

      // Create event before deletion
      await this.createTournamentEvent(
        queryRunner,
        id,
        TournamentEventType.TOURNAMENT_DELETED,
        { tournament },
      );

      // Delete tournament (cascade will handle related entities)
      await queryRunner.manager.remove(tournament);

      await queryRunner.commitTransaction();

      // Invalidate cache
      await this.cacheService.invalidateTournament(id);

      // Emit event
      this.eventEmitter.emit('tournament.deleted', { tournamentId: id });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getParticipants(
    tournamentId: string,
  ): Promise<TournamentParticipant[]> {
    return this.participantRepository.find({
      where: { tournamentId },
      order: { registeredAt: 'ASC' },
    });
  }

  async removeParticipant(
    tournamentId: string,
    participantId: string,
    userId: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const tournament = await this.findTournamentById(tournamentId);
      const participant = await this.participantRepository.findOne({
        where: { id: participantId, tournamentId },
      });

      if (!participant) {
        throw new NotFoundException('Participant not found');
      }

      // Check if user can remove participant (tournament owner or the participant themselves)
      if (tournament.createdBy !== userId && participant.playerId !== userId) {
        throw new BadRequestException(
          'Not authorized to remove this participant',
        );
      }

      // Cannot remove if tournament has started
      if (
        tournament.status === TournamentStatus.IN_PROGRESS ||
        tournament.status === TournamentStatus.COMPLETED
      ) {
        throw new BadRequestException(
          'Cannot remove participant from active tournament',
        );
      }

      // Remove participant
      await queryRunner.manager.remove(participant);

      // Create event
      await this.createTournamentEvent(
        queryRunner,
        tournamentId,
        TournamentEventType.PARTICIPANT_REMOVED,
        { participant, removedBy: userId },
      );

      await queryRunner.commitTransaction();

      // Update cache
      await this.cacheService.invalidateTournament(tournamentId);
      await this.cacheService.decrementParticipantCount(tournamentId);

      // Emit event
      this.eventEmitter.emit('tournament.participant.removed', {
        tournament,
        participant,
        removedBy: userId,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getMatches(tournamentId: string, round?: number): Promise<Match[]> {
    const where: any = { tournamentId };
    if (round !== undefined) {
      where.round = round;
    }

    return this.matchRepository.find({
      where,
      relations: ['homeParticipant', 'awayParticipant'],
      order: { round: 'ASC', matchNumber: 'ASC' },
    });
  }

  async getTournamentStats(tournamentId: string): Promise<any> {
    const tournament = await this.findTournamentWithParticipants(tournamentId);

    const totalMatches = await this.matchRepository.count({
      where: { tournamentId },
    });

    const completedMatches = await this.matchRepository.count({
      where: { tournamentId, status: MatchStatus.COMPLETED },
    });

    const activeMatches = await this.matchRepository.count({
      where: { tournamentId, status: MatchStatus.IN_PROGRESS },
    });

    const averageMatchDuration = await this.matchRepository
      .createQueryBuilder('match')
      .select(
        'AVG(EXTRACT(EPOCH FROM (match.completedAt - match.startedAt)))',
        'avgDuration',
      )
      .where('match.tournamentId = :tournamentId', { tournamentId })
      .andWhere('match.completedAt IS NOT NULL')
      .andWhere('match.startedAt IS NOT NULL')
      .getRawOne();

    return {
      tournament: {
        id: tournament.id,
        name: tournament.name,
        format: tournament.format,
        status: tournament.status,
        participantCount: tournament.participantCount,
        maxParticipants: tournament.maxParticipants,
        startAt: tournament.startAt,
        endAt: tournament.endAt,
      },
      matches: {
        total: totalMatches,
        completed: completedMatches,
        active: activeMatches,
        pending: totalMatches - completedMatches - activeMatches,
        averageDuration: averageMatchDuration?.avgDuration
          ? Math.round(Number(averageMatchDuration.avgDuration))
          : null,
      },
      participants: {
        total: tournament.participantCount,
        active: tournament.participants.filter(
          (p) => p.status === ParticipantStatus.ACTIVE,
        ).length,
        eliminated: tournament.participants.filter(
          (p) => p.status === ParticipantStatus.ELIMINATED,
        ).length,
      },
      progress: totalMatches > 0 ? (completedMatches / totalMatches) * 100 : 0,
    };
  }
}
