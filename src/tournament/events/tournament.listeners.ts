import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { TournamentCacheService } from '../services/tournament-cache.service';
import {
  TournamentCreatedEvent,
  TournamentStartedEvent,
  TournamentCompletedEvent,
  ParticipantRegisteredEvent,
  ParticipantEliminatedEvent,
  MatchStartedEvent,
  MatchCompletedEvent,
  MatchScheduledEvent,
  RoundCompletedEvent,
  LeaderboardUpdatedEvent,
  PrizeDistributedEvent,
} from './tournament.events';

@Injectable()
export class TournamentEventListeners {
  private readonly logger = new Logger(TournamentEventListeners.name);

  constructor(
    @InjectQueue('match-processing')
    private readonly matchQueue: Queue,
    @InjectQueue('notification')
    private readonly notificationQueue: Queue,
    private readonly cacheService: TournamentCacheService,
  ) {}

  @OnEvent('tournament.created')
  async handleTournamentCreated(event: TournamentCreatedEvent) {
    this.logger.log(`Tournament created: ${event.tournamentId}`);

    try {
      // Cache the new tournament
      await this.cacheService.cacheTournament(event.tournament);

      // Send welcome notifications to creator
      await this.notificationQueue.add('send-notification', {
        type: 'tournament_created',
        recipientId: event.createdBy,
        data: {
          tournamentId: event.tournamentId,
          tournamentName: event.tournament.name,
        },
      });

      // Analytics tracking
      await this.trackEvent('tournament_created', {
        tournamentId: event.tournamentId,
        format: event.tournament.format,
        createdBy: event.createdBy,
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle tournament created event: ${error.message}`,
      );
    }
  }

  @OnEvent('tournament.started')
  async handleTournamentStarted(event: TournamentStartedEvent) {
    this.logger.log(`Tournament started: ${event.tournamentId}`);

    try {
      // Update tournament cache
      await this.cacheService.invalidateTournament(event.tournamentId);

      // Send notifications to all participants
      if (event.tournament.participants) {
        for (const participant of event.tournament.participants) {
          await this.notificationQueue.add('send-notification', {
            type: 'tournament_started',
            recipientId: participant.playerId,
            data: {
              tournamentId: event.tournamentId,
              tournamentName: event.tournament.name,
              startedAt: event.startedAt,
            },
          });
        }
      }

      // Schedule first round matches if not already scheduled
      await this.matchQueue.add(
        'schedule-round-matches',
        {
          tournamentId: event.tournamentId,
          round: 1,
        },
        { delay: 5000 }, // 5 second delay
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle tournament started event: ${error.message}`,
      );
    }
  }

  @OnEvent('tournament.completed')
  async handleTournamentCompleted(event: TournamentCompletedEvent) {
    this.logger.log(`Tournament completed: ${event.tournamentId}`);

    try {
      // Update cache
      await this.cacheService.invalidateTournament(event.tournamentId);

      // Send completion notifications
      if (event.tournament.participants) {
        for (const participant of event.tournament.participants) {
          await this.notificationQueue.add('send-notification', {
            type: 'tournament_completed',
            recipientId: participant.playerId,
            data: {
              tournamentId: event.tournamentId,
              tournamentName: event.tournament.name,
              winnerId: event.winner?.id,
              finalRank: participant.currentRank,
              completedAt: event.completedAt,
            },
          });
        }
      }

      // Generate tournament report
      await this.matchQueue.add('generate-tournament-report', {
        tournamentId: event.tournamentId,
      });

      // Analytics tracking
      await this.trackEvent('tournament_completed', {
        tournamentId: event.tournamentId,
        participantCount: event.tournament.participants?.length || 0,
        duration: this.calculateTournamentDuration(event.tournament),
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle tournament completed event: ${error.message}`,
      );
    }
  }

  @OnEvent('tournament.participant.registered')
  async handleParticipantRegistered(event: ParticipantRegisteredEvent) {
    this.logger.log(
      `Participant registered for tournament: ${event.tournamentId}`,
    );

    try {
      // Update cache
      await this.cacheService.invalidateTournament(event.tournamentId);
      await this.cacheService.incrementParticipantCount(event.tournamentId);

      // Send confirmation notification
      await this.notificationQueue.add('send-notification', {
        type: 'tournament_registration_confirmed',
        recipientId: event.participant.playerId,
        data: {
          tournamentId: event.tournamentId,
          tournamentName: event.tournament.name,
          registrationStartAt: event.tournament.registrationStartAt,
          startAt: event.tournament.startAt,
        },
      });

      // Check if tournament is now full
      if (event.tournament.isFull) {
        await this.notificationQueue.add('send-notification', {
          type: 'tournament_full',
          recipientId: event.tournament.createdBy,
          data: {
            tournamentId: event.tournamentId,
            tournamentName: event.tournament.name,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle participant registered event: ${error.message}`,
      );
    }
  }

  @OnEvent('tournament.participant.eliminated')
  async handleParticipantEliminated(event: ParticipantEliminatedEvent) {
    this.logger.log(
      `Participant eliminated from tournament: ${event.tournamentId}`,
    );

    try {
      // Send elimination notification
      await this.notificationQueue.add('send-notification', {
        type: 'tournament_elimination',
        recipientId: event.participant.playerId,
        data: {
          tournamentId: event.tournamentId,
          round: event.round,
          finalRank: event.participant.currentRank,
          eliminatedAt: event.eliminatedAt,
        },
      });

      // Update leaderboard
      await this.matchQueue.add('update-leaderboard', {
        tournamentId: event.tournamentId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle participant eliminated event: ${error.message}`,
      );
    }
  }

  @OnEvent('match.started')
  async handleMatchStarted(event: MatchStartedEvent) {
    this.logger.log(`Match started: ${event.matchId}`);

    try {
      // Send match started notifications to participants
      for (const participantId of event.participants) {
        if (participantId) {
          await this.notificationQueue.add('send-notification', {
            type: 'match_started',
            recipientId: participantId,
            data: {
              matchId: event.matchId,
              tournamentId: event.tournamentId,
              startedAt: event.startedAt,
            },
          });
        }
      }

      // Update cache
      await this.cacheService.cacheActiveMatches(event.tournamentId, [
        event.matchId,
      ]);
    } catch (error) {
      this.logger.error(
        `Failed to handle match started event: ${error.message}`,
      );
    }
  }

  @OnEvent('tournament.match.completed')
  async handleMatchCompleted(event: MatchCompletedEvent) {
    this.logger.log(`Match completed: ${event.matchId}`);

    try {
      // Process match completion
      await this.matchQueue.add(
        'complete-match',
        {
          matchId: event.matchId,
          tournamentId: event.tournamentId,
        },
        { priority: 1 },
      );

      // Send match result notifications
      if (event.match.homeParticipantId) {
        await this.notificationQueue.add('send-notification', {
          type: 'match_result',
          recipientId: event.match.homeParticipantId,
          data: {
            matchId: event.matchId,
            tournamentId: event.tournamentId,
            result: event.result,
            isWinner: event.result.winnerId === event.match.homeParticipantId,
          },
        });
      }

      if (event.match.awayParticipantId) {
        await this.notificationQueue.add('send-notification', {
          type: 'match_result',
          recipientId: event.match.awayParticipantId,
          data: {
            matchId: event.matchId,
            tournamentId: event.tournamentId,
            result: event.result,
            isWinner: event.result.winnerId === event.match.awayParticipantId,
          },
        });
      }
    } catch (error) {
      this.logger.error(
        `Failed to handle match completed event: ${error.message}`,
      );
    }
  }

  @OnEvent('match.scheduled')
  async handleMatchScheduled(event: MatchScheduledEvent) {
    this.logger.log(`Match scheduled: ${event.matchId}`);

    try {
      // Send scheduling notifications
      await this.notificationQueue.add('send-notification', {
        type: 'match_scheduled',
        tournamentId: event.tournamentId,
        data: {
          matchId: event.matchId,
          scheduledAt: event.scheduledAt,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle match scheduled event: ${error.message}`,
      );
    }
  }

  @OnEvent('tournament.round_completed')
  async handleRoundCompleted(event: RoundCompletedEvent) {
    this.logger.log(
      `Round completed for tournament: ${event.tournamentId}, round: ${event.round}`,
    );

    try {
      // Schedule next round matches
      await this.matchQueue.add(
        'schedule-round-matches',
        {
          tournamentId: event.tournamentId,
          round: event.round + 1,
        },
        { delay: 10000 }, // 10 second delay
      );

      // Update leaderboard
      await this.matchQueue.add('update-leaderboard', {
        tournamentId: event.tournamentId,
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle round completed event: ${error.message}`,
      );
    }
  }

  @OnEvent('tournament.leaderboard_updated')
  async handleLeaderboardUpdated(event: LeaderboardUpdatedEvent) {
    this.logger.log(`Leaderboard updated: ${event.tournamentId}`);

    try {
      // Cache updated leaderboard
      await this.cacheService.cacheLeaderboard(
        event.tournamentId,
        event.leaderboard,
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle leaderboard updated event: ${error.message}`,
      );
    }
  }

  @OnEvent('tournament.prize.distributed')
  async handlePrizeDistributed(event: PrizeDistributedEvent) {
    this.logger.log(`Prize distributed for tournament: ${event.tournamentId}`);

    try {
      // Send prize notification
      await this.notificationQueue.add('send-notification', {
        type: 'prize_awarded',
        recipientId: event.participant.playerId,
        data: {
          tournamentId: event.tournamentId,
          prize: event.prize,
          distributedAt: event.distributedAt,
        },
      });
    } catch (error) {
      this.logger.error(
        `Failed to handle prize distributed event: ${error.message}`,
      );
    }
  }

  // Helper methods
  private async trackEvent(eventType: string, data: any) {
    // Implementation would send to analytics service
    this.logger.debug(`Analytics event: ${eventType}`, data);
  }

  private calculateTournamentDuration(tournament: any): number {
    if (tournament.startAt && tournament.endAt) {
      return tournament.endAt.getTime() - tournament.startAt.getTime();
    }
    return 0;
  }
}
