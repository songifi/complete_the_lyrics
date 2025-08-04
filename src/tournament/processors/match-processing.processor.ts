import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Match } from '../entities/match.entity';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { MatchResult } from '../entities/match-result.entity';
import { TournamentCacheService } from '../services/tournament-cache.service';
import {
  MatchStatus,
  TournamentEventType,
  ParticipantStatus,
} from '../enums/tournament.enums';

interface MatchJobData {
  matchId: string;
  tournamentId?: string;
  priority?: number;
}

interface AutoCompleteData extends MatchJobData {
  reason: 'timeout' | 'no_show' | 'forfeit';
  winnerId?: string;
}

interface BracketAdvancementData {
  tournamentId: string;
  completedMatchId: string;
  winnerId: string;
  round: number;
}

@Processor('match-processing')
@Injectable()
export class MatchProcessingProcessor {
  private readonly logger = new Logger(MatchProcessingProcessor.name);

  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Tournament)
    private tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentParticipant)
    private participantRepository: Repository<TournamentParticipant>,
    @InjectRepository(MatchResult)
    private matchResultRepository: Repository<MatchResult>,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private cacheService: TournamentCacheService,
  ) {}

  @Process({ name: 'start-match', concurrency: 5 })
  async startMatch(job: Job<MatchJobData>) {
    const { matchId } = job.data;
    this.logger.log(`Starting match ${matchId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const match = await this.matchRepository.findOne({
        where: { id: matchId },
        relations: ['homeParticipant', 'awayParticipant', 'tournament'],
      });

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      if (match.status !== MatchStatus.SCHEDULED) {
        this.logger.warn(
          `Match ${matchId} is not in scheduled status: ${match.status}`,
        );
        return;
      }

      // Check if participants are available
      const participantsAvailable =
        await this.checkParticipantsAvailable(match);
      if (!participantsAvailable) {
        await this.handleNoShow(queryRunner, match);
        await queryRunner.commitTransaction();
        return;
      }

      // Start the match
      match.status = MatchStatus.IN_PROGRESS;
      match.startedAt = new Date();
      await queryRunner.manager.save(match);

      // Update participant statuses
      if (match.homeParticipant) {
        match.homeParticipant.status = ParticipantStatus.ACTIVE;
        await queryRunner.manager.save(match.homeParticipant);
      }

      if (match.awayParticipant) {
        match.awayParticipant.status = ParticipantStatus.ACTIVE;
        await queryRunner.manager.save(match.awayParticipant);
      }

      // Update cache
      await this.cacheService.cacheActiveMatches(match.tournamentId, [matchId]);

      await queryRunner.commitTransaction();

      // Emit events
      this.eventEmitter.emit('match.started', {
        matchId,
        tournamentId: match.tournamentId,
        participants: [match.homeParticipantId, match.awayParticipantId],
        startedAt: match.startedAt,
      });

      this.logger.log(`Successfully started match ${matchId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to start match ${matchId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  @Process({ name: 'complete-match', concurrency: 10 })
  async completeMatch(job: Job<MatchJobData>) {
    const { matchId } = job.data;
    this.logger.log(`Processing match completion ${matchId}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const match = await this.matchRepository.findOne({
        where: { id: matchId },
        relations: ['homeParticipant', 'awayParticipant', 'tournament'],
      });

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      if (match.status !== MatchStatus.COMPLETED) {
        this.logger.warn(`Match ${matchId} is not completed: ${match.status}`);
        return;
      }

      // Process match results
      await this.processMatchResults(queryRunner, match);

      // Update participant statistics
      await this.updateParticipantStatistics(queryRunner, match);

      // Check for bracket advancement
      await this.processBracketAdvancement(queryRunner, match);

      // Check if round is complete
      await this.checkRoundCompletion(queryRunner, match);

      await queryRunner.commitTransaction();

      // Emit completion event
      this.eventEmitter.emit('match.processed', {
        matchId,
        tournamentId: match.tournamentId,
        winnerId: match.winnerId,
        results: await this.getMatchResults(matchId),
      });

      this.logger.log(`Successfully processed match completion ${matchId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to process match completion ${matchId}:`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  @Process({ name: 'auto-complete-match', concurrency: 3 })
  async autoCompleteMatch(job: Job<AutoCompleteData>) {
    const { matchId, reason, winnerId } = job.data;
    this.logger.log(`Auto-completing match ${matchId} due to ${reason}`);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const match = await this.matchRepository.findOne({
        where: { id: matchId },
        relations: ['homeParticipant', 'awayParticipant', 'tournament'],
      });

      if (!match) {
        throw new Error(`Match ${matchId} not found`);
      }

      if (match.status === MatchStatus.COMPLETED) {
        this.logger.log(`Match ${matchId} already completed`);
        return;
      }

      // Determine winner based on reason
      let finalWinnerId = winnerId;
      if (!finalWinnerId) {
        finalWinnerId = await this.determineWinnerByReason(match, reason);
      }

      // Set match results based on auto-completion reason
      const { homeScore, awayScore } = this.getAutoCompletionScores(
        match,
        reason,
        finalWinnerId,
      );

      // Update match
      match.status = MatchStatus.COMPLETED;
      match.completedAt = new Date();
      match.homeScore = homeScore;
      match.awayScore = awayScore;
      match.winnerId = finalWinnerId;
      match.notes = `Auto-completed due to ${reason}`;

      await queryRunner.manager.save(match);

      // Create match results
      await this.createAutoCompletionResults(queryRunner, match, reason);

      // Process the completion
      await this.processMatchResults(queryRunner, match);
      await this.updateParticipantStatistics(queryRunner, match);
      await this.processBracketAdvancement(queryRunner, match);

      await queryRunner.commitTransaction();

      // Emit events
      this.eventEmitter.emit('match.auto_completed', {
        matchId,
        reason,
        winnerId: finalWinnerId,
        tournamentId: match.tournamentId,
      });

      this.logger.log(`Successfully auto-completed match ${matchId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to auto-complete match ${matchId}:`, error);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  @Process({ name: 'advance-bracket', concurrency: 5 })
  async advanceBracket(job: Job<BracketAdvancementData>) {
    const { tournamentId, completedMatchId, winnerId, round } = job.data;
    this.logger.log(
      `Advancing bracket for tournament ${tournamentId}, match ${completedMatchId}`,
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find next round matches that this winner should advance to
      const nextRoundMatches = await this.matchRepository.find({
        where: {
          tournamentId,
          round: round + 1,
        },
        order: { matchNumber: 'ASC' },
      });

      if (nextRoundMatches.length === 0) {
        // Tournament might be complete
        await this.checkTournamentCompletion(queryRunner, tournamentId);
        await queryRunner.commitTransaction();
        return;
      }

      // Find the appropriate next match for this winner
      const nextMatch = await this.findNextMatchForWinner(
        queryRunner,
        completedMatchId,
        winnerId,
        nextRoundMatches,
      );

      if (nextMatch) {
        // Place winner in next match
        if (!nextMatch.homeParticipantId) {
          nextMatch.homeParticipantId = winnerId;
        } else if (!nextMatch.awayParticipantId) {
          nextMatch.awayParticipantId = winnerId;
        }

        await queryRunner.manager.save(nextMatch);

        // If both participants are now set, the match can be scheduled
        if (nextMatch.homeParticipantId && nextMatch.awayParticipantId) {
          this.eventEmitter.emit('match.ready_for_scheduling', {
            matchId: nextMatch.id,
            tournamentId,
            round: nextMatch.round,
          });
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Successfully advanced bracket for match ${completedMatchId}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to advance bracket for match ${completedMatchId}:`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  @Process({ name: 'update-leaderboard', concurrency: 3 })
  async updateLeaderboard(job: Job<{ tournamentId: string }>) {
    const { tournamentId } = job.data;
    this.logger.log(`Updating leaderboard for tournament ${tournamentId}`);

    try {
      const participants = await this.participantRepository.find({
        where: { tournamentId },
        order: {
          points: 'DESC',
          wins: 'DESC',
          losses: 'ASC',
        },
      });

      // Update rankings
      for (let i = 0; i < participants.length; i++) {
        participants[i].currentRank = i + 1;
        await this.participantRepository.save(participants[i]);
      }

      // Cache updated leaderboard
      await this.cacheService.cacheLeaderboard(tournamentId, participants);

      // Emit leaderboard update event
      this.eventEmitter.emit('tournament.leaderboard_updated', {
        tournamentId,
        leaderboard: participants.slice(0, 10), // Top 10
      });

      this.logger.log(
        `Successfully updated leaderboard for tournament ${tournamentId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update leaderboard for tournament ${tournamentId}:`,
        error,
      );
      throw error;
    }
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(
      `Job ${job.id} completed with result: ${JSON.stringify(result)}`,
    );
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.id} failed with error: ${err.message}`);
  }

  // Helper methods
  private async checkParticipantsAvailable(match: Match): Promise<boolean> {
    // Check if participants are online/available
    // This would integrate with presence service
    return true; // Mock implementation
  }

  private async handleNoShow(queryRunner: any, match: Match): Promise<void> {
    match.status = MatchStatus.CANCELLED;
    match.notes = 'Match cancelled due to participant no-show';
    await queryRunner.manager.save(match);

    // Handle forfeit logic if needed
    if (match.homeParticipant && !match.awayParticipant) {
      match.winnerId = match.homeParticipantId;
    } else if (!match.homeParticipant && match.awayParticipant) {
      match.winnerId = match.awayParticipantId;
    }
  }

  private async processMatchResults(
    queryRunner: any,
    match: Match,
  ): Promise<void> {
    // Additional result processing logic
    // Could include statistics calculation, achievements, etc.
  }

  private async updateParticipantStatistics(
    queryRunner: any,
    match: Match,
  ): Promise<void> {
    if (match.homeParticipant) {
      const homeStats = match.homeParticipant;
      if (match.winnerId === homeStats.id) {
        homeStats.wins += 1;
        homeStats.points += 3;
      } else if (match.isDraw) {
        homeStats.draws += 1;
        homeStats.points += 1;
      } else {
        homeStats.losses += 1;
      }
      await queryRunner.manager.save(homeStats);
    }

    if (match.awayParticipant) {
      const awayStats = match.awayParticipant;
      if (match.winnerId === awayStats.id) {
        awayStats.wins += 1;
        awayStats.points += 3;
      } else if (match.isDraw) {
        awayStats.draws += 1;
        awayStats.points += 1;
      } else {
        awayStats.losses += 1;
      }
      await queryRunner.manager.save(awayStats);
    }
  }

  private async processBracketAdvancement(
    queryRunner: any,
    match: Match,
  ): Promise<void> {
    if (match.winnerId) {
      // Add job to advance winner to next round
      const job = await queryRunner.connection.manager
        .getRepository('Queue')
        .create({
          name: 'advance-bracket',
          data: {
            tournamentId: match.tournamentId,
            completedMatchId: match.id,
            winnerId: match.winnerId,
            round: match.round,
          },
          priority: 1,
        });
      // This would be added to the actual queue
    }
  }

  private async checkRoundCompletion(
    queryRunner: any,
    match: Match,
  ): Promise<void> {
    const roundMatches = await this.matchRepository.find({
      where: {
        tournamentId: match.tournamentId,
        round: match.round,
      },
    });

    const completedMatches = roundMatches.filter(
      (m) => m.status === MatchStatus.COMPLETED,
    );

    if (completedMatches.length === roundMatches.length) {
      this.eventEmitter.emit('tournament.round_completed', {
        tournamentId: match.tournamentId,
        round: match.round,
      });
    }
  }

  private async determineWinnerByReason(
    match: Match,
    reason: string,
  ): Promise<string | undefined> {
    switch (reason) {
      case 'no_show':
        // Determine who showed up
        return this.determineWinnerByNoShow(match);
      case 'forfeit':
        // Would have forfeit data
        return undefined;
      case 'timeout':
        // Determine winner by current score or random
        return this.determineWinnerByTimeout(match);
      default:
        return undefined;
    }
  }

  private determineWinnerByNoShow(match: Match): string | undefined {
    // Mock logic - would check actual presence
    return match.homeParticipantId || match.awayParticipantId;
  }

  private determineWinnerByTimeout(match: Match): string | undefined {
    // If there are current scores, use those; otherwise random
    if (match.homeScore && match.awayScore) {
      return match.homeScore > match.awayScore
        ? match.homeParticipantId
        : match.awayParticipantId;
    }
    return Math.random() > 0.5
      ? match.homeParticipantId
      : match.awayParticipantId;
  }

  private getAutoCompletionScores(
    match: Match,
    reason: string,
    winnerId?: string,
  ): { homeScore: number; awayScore: number } {
    if (reason === 'forfeit' || reason === 'no_show') {
      return winnerId === match.homeParticipantId
        ? { homeScore: 1, awayScore: 0 }
        : { homeScore: 0, awayScore: 1 };
    }

    // For timeout, use current scores or default
    return {
      homeScore: match.homeScore || 0,
      awayScore: match.awayScore || 0,
    };
  }

  private async createAutoCompletionResults(
    queryRunner: any,
    match: Match,
    reason: string,
  ): Promise<void> {
    if (match.homeParticipant) {
      const result = this.matchResultRepository.create({
        matchId: match.id,
        participantId: match.homeParticipant.id,
        score: match.homeScore || 0,
        performance: { autoCompleted: true, reason },
      });
      await queryRunner.manager.save(result);
    }

    if (match.awayParticipant) {
      const result = this.matchResultRepository.create({
        matchId: match.id,
        participantId: match.awayParticipant.id,
        score: match.awayScore || 0,
        performance: { autoCompleted: true, reason },
      });
      await queryRunner.manager.save(result);
    }
  }

  private async findNextMatchForWinner(
    queryRunner: any,
    completedMatchId: string,
    winnerId: string,
    nextRoundMatches: Match[],
  ): Promise<Match | undefined> {
    // Simple implementation - would need more complex logic for different tournament formats
    const matchIndex = parseInt(completedMatchId.split('m')[1]) || 1;
    const nextMatchIndex = Math.floor((matchIndex - 1) / 2);

    return nextRoundMatches[nextMatchIndex];
  }

  private async checkTournamentCompletion(
    queryRunner: any,
    tournamentId: string,
  ): Promise<void> {
    const allMatches = await this.matchRepository.find({
      where: { tournamentId },
    });

    const completedMatches = allMatches.filter(
      (m) => m.status === MatchStatus.COMPLETED,
    );

    if (completedMatches.length === allMatches.length) {
      // Tournament is complete
      this.eventEmitter.emit('tournament.completed', { tournamentId });
    }
  }

  private async getMatchResults(matchId: string): Promise<MatchResult[]> {
    return this.matchResultRepository.find({
      where: { matchId },
      relations: ['participant'],
    });
  }
}
