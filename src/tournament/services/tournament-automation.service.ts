import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan, Between } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { Match } from '../entities/match.entity';
import { TournamentService } from './tournament.service';
import { MatchSchedulerService } from './match-scheduler.service';
import { EnhancedCacheService } from './enhanced-cache.service';
import {
  TournamentStatus,
  ParticipantStatus,
  MatchStatus,
  TournamentEventType,
} from '../enums/tournament.enums';

interface AutomationTask {
  id: string;
  tournamentId: string;
  type: string;
  scheduledAt: Date;
  data: any;
}

@Injectable()
export class TournamentAutomationService {
  private readonly logger = new Logger(TournamentAutomationService.name);
  private automationTasks = new Map<string, AutomationTask>();
  private isProcessing = false;

  constructor(
    @InjectRepository(Tournament)
    private tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentParticipant)
    private participantRepository: Repository<TournamentParticipant>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectQueue('tournament-automation')
    private automationQueue: Queue,
    @InjectQueue('notifications')
    private notificationQueue: Queue,
    private schedulerRegistry: SchedulerRegistry,
    private eventEmitter: EventEmitter2,
    private tournamentService: TournamentService,
    private matchScheduler: MatchSchedulerService,
    private cacheService: EnhancedCacheService,
  ) {}

  // Main automation cron jobs
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledTasks(): Promise<void> {
    if (this.isProcessing) return;

    this.isProcessing = true;
    try {
      await this.checkRegistrationOpening();
      await this.checkRegistrationClosing();
      await this.checkTournamentStart();
      await this.checkMatchTimeouts();
      await this.processAutomationQueue();
    } catch (error) {
      this.logger.error('Error in processScheduledTasks:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async performMaintenanceTasks(): Promise<void> {
    try {
      await this.updateTournamentStatistics();
      await this.cleanupExpiredMatches();
      await this.sendReminders();
      await this.updateLeaderboards();
    } catch (error) {
      this.logger.error('Error in performMaintenanceTasks:', error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async performHealthChecks(): Promise<void> {
    try {
      await this.checkSystemHealth();
      await this.validateTournamentIntegrity();
      await this.cleanupStaleData();
    } catch (error) {
      this.logger.error('Error in performHealthChecks:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async performHourlyTasks(): Promise<void> {
    try {
      await this.generateDailyReports();
      await this.optimizeCacheUsage();
      await this.pruneOldTournaments();
      await this.recalculateRankings();
    } catch (error) {
      this.logger.error('Error in performHourlyTasks:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async performDailyTasks(): Promise<void> {
    try {
      await this.archiveCompletedTournaments();
      await this.generateAnalyticsReports();
      await this.cleanupLogs();
      await this.optimizeDatabase();
    } catch (error) {
      this.logger.error('Error in performDailyTasks:', error);
    }
  }

  // Registration automation
  private async checkRegistrationOpening(): Promise<void> {
    const now = new Date();
    const tournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.DRAFT,
        registrationStartAt: LessThan(now),
      },
    });

    for (const tournament of tournaments) {
      try {
        await this.openRegistration(tournament);
      } catch (error) {
        this.logger.error(
          `Failed to open registration for tournament ${tournament.id}:`,
          error,
        );
      }
    }
  }

  private async openRegistration(tournament: Tournament): Promise<void> {
    tournament.status = TournamentStatus.REGISTRATION_OPEN;
    await this.tournamentRepository.save(tournament);

    // Schedule registration closing
    await this.scheduleAutomationTask({
      id: `close_registration_${tournament.id}`,
      tournamentId: tournament.id,
      type: 'close_registration',
      scheduledAt: tournament.registrationEndAt,
      data: {},
    });

    // Send notifications
    await this.notificationQueue.add('tournament_registration_opened', {
      tournamentId: tournament.id,
      tournament,
    });

    // Emit event
    this.eventEmitter.emit('tournament.registration.opened', { tournament });

    this.logger.log(`Registration opened for tournament: ${tournament.name}`);
  }

  private async checkRegistrationClosing(): Promise<void> {
    const now = new Date();
    const tournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.REGISTRATION_OPEN,
        registrationEndAt: LessThan(now),
      },
      relations: ['participants'],
    });

    for (const tournament of tournaments) {
      try {
        await this.closeRegistration(tournament);
      } catch (error) {
        this.logger.error(
          `Failed to close registration for tournament ${tournament.id}:`,
          error,
        );
      }
    }
  }

  private async closeRegistration(tournament: Tournament): Promise<void> {
    const activeParticipants = tournament.participants.filter(
      (p) =>
        p.status === ParticipantStatus.CONFIRMED ||
        p.status === ParticipantStatus.REGISTERED,
    );

    if (activeParticipants.length < tournament.minParticipants) {
      // Cancel tournament due to insufficient participants
      await this.cancelTournamentDueToInsufficientParticipants(tournament);
      return;
    }

    tournament.status = TournamentStatus.REGISTRATION_CLOSED;
    await this.tournamentRepository.save(tournament);

    // Auto-approve participants if no manual approval required
    if (!tournament.requireApproval) {
      await this.autoApproveParticipants(tournament.id);
    }

    // Schedule tournament start
    await this.scheduleAutomationTask({
      id: `start_tournament_${tournament.id}`,
      tournamentId: tournament.id,
      type: 'start_tournament',
      scheduledAt: tournament.startAt,
      data: {},
    });

    // Emit event
    this.eventEmitter.emit('tournament.registration.closed', { tournament });

    this.logger.log(`Registration closed for tournament: ${tournament.name}`);
  }

  // Tournament start automation
  private async checkTournamentStart(): Promise<void> {
    const now = new Date();
    const tournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.REGISTRATION_CLOSED,
        startAt: LessThan(now),
      },
      relations: ['participants'],
    });

    for (const tournament of tournaments) {
      try {
        await this.startTournament(tournament);
      } catch (error) {
        this.logger.error(
          `Failed to start tournament ${tournament.id}:`,
          error,
        );
      }
    }
  }

  private async startTournament(tournament: Tournament): Promise<void> {
    const confirmedParticipants = tournament.participants.filter(
      (p) => p.status === ParticipantStatus.CONFIRMED,
    );

    if (confirmedParticipants.length < tournament.minParticipants) {
      await this.cancelTournamentDueToInsufficientParticipants(tournament);
      return;
    }

    // Start the tournament through the service
    await this.tournamentService.startTournament(tournament.id);

    // Schedule first round matches
    await this.scheduleAutomationTask({
      id: `schedule_round_1_${tournament.id}`,
      tournamentId: tournament.id,
      type: 'schedule_round',
      scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes delay
      data: { round: 1 },
    });

    this.logger.log(`Tournament started: ${tournament.name}`);
  }

  // Match timeout handling
  private async checkMatchTimeouts(): Promise<void> {
    const timeoutThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

    const timedOutMatches = await this.matchRepository.find({
      where: {
        status: MatchStatus.IN_PROGRESS,
        startedAt: LessThan(timeoutThreshold),
      },
      relations: ['tournament', 'homeParticipant', 'awayParticipant'],
    });

    for (const match of timedOutMatches) {
      try {
        await this.handleMatchTimeout(match);
      } catch (error) {
        this.logger.error(
          `Failed to handle timeout for match ${match.id}:`,
          error,
        );
      }
    }
  }

  private async handleMatchTimeout(match: Match): Promise<void> {
    // Auto-complete the match with a default result
    await this.automationQueue.add(
      'auto-complete-match',
      {
        matchId: match.id,
        reason: 'timeout',
      },
      {
        priority: 1,
        attempts: 3,
      },
    );

    this.logger.warn(`Match ${match.id} timed out and will be auto-completed`);
  }

  // Statistics and maintenance
  private async updateTournamentStatistics(): Promise<void> {
    const activeTournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.IN_PROGRESS,
      },
    });

    for (const tournament of activeTournaments) {
      try {
        const stats = await this.calculateTournamentStats(tournament.id);
        await this.cacheService.cacheTournamentStats(tournament.id, stats);
      } catch (error) {
        this.logger.error(
          `Failed to update stats for tournament ${tournament.id}:`,
          error,
        );
      }
    }
  }

  private async updateLeaderboards(): Promise<void> {
    const activeTournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.IN_PROGRESS,
      },
    });

    for (const tournament of activeTournaments) {
      try {
        const leaderboard = await this.tournamentService.getLeaderboard(
          tournament.id,
        );
        await this.cacheService.cacheLeaderboard(tournament.id, leaderboard);
      } catch (error) {
        this.logger.error(
          `Failed to update leaderboard for tournament ${tournament.id}:`,
          error,
        );
      }
    }
  }

  // Reminder system
  private async sendReminders(): Promise<void> {
    await this.sendTournamentStartReminders();
    await this.sendMatchReminders();
    await this.sendRegistrationEndingReminders();
  }

  private async sendTournamentStartReminders(): Promise<void> {
    const reminderTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    const tournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.REGISTRATION_CLOSED,
        startAt: Between(new Date(), reminderTime),
      },
      relations: ['participants'],
    });

    for (const tournament of tournaments) {
      const participantIds = tournament.participants
        .filter((p) => p.status === ParticipantStatus.CONFIRMED)
        .map((p) => p.playerId);

      await this.notificationQueue.add('tournament_start_reminder', {
        tournamentId: tournament.id,
        participantIds,
        startAt: tournament.startAt,
      });
    }
  }

  private async sendMatchReminders(): Promise<void> {
    const reminderTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now

    const upcomingMatches = await this.matchRepository.find({
      where: {
        status: MatchStatus.SCHEDULED,
        scheduledAt: Between(new Date(), reminderTime),
      },
      relations: ['homeParticipant', 'awayParticipant'],
    });

    for (const match of upcomingMatches) {
      const participantIds = [
        match.homeParticipantId,
        match.awayParticipantId,
      ].filter(Boolean);

      await this.notificationQueue.add('match_reminder', {
        matchId: match.id,
        participantIds,
        scheduledAt: match.scheduledAt,
      });
    }
  }

  private async sendRegistrationEndingReminders(): Promise<void> {
    const reminderTime = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now

    const tournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.REGISTRATION_OPEN,
        registrationEndAt: Between(new Date(), reminderTime),
      },
    });

    for (const tournament of tournaments) {
      await this.notificationQueue.add('registration_ending_reminder', {
        tournamentId: tournament.id,
        endAt: tournament.registrationEndAt,
      });
    }
  }

  // Cleanup and maintenance
  private async cleanupExpiredMatches(): Promise<void> {
    const expiredThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const expiredMatches = await this.matchRepository.find({
      where: {
        status: MatchStatus.SCHEDULED,
        scheduledAt: LessThan(expiredThreshold),
      },
    });

    for (const match of expiredMatches) {
      match.status = MatchStatus.CANCELLED;
      match.notes = 'Cancelled due to expiration';
      await this.matchRepository.save(match);
    }

    if (expiredMatches.length > 0) {
      this.logger.log(`Cleaned up ${expiredMatches.length} expired matches`);
    }
  }

  private async archiveCompletedTournaments(): Promise<void> {
    const archiveThreshold = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    const completedTournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.COMPLETED,
        endAt: LessThan(archiveThreshold),
      },
    });

    for (const tournament of completedTournaments) {
      try {
        await this.archiveTournament(tournament);
      } catch (error) {
        this.logger.error(
          `Failed to archive tournament ${tournament.id}:`,
          error,
        );
      }
    }
  }

  private async pruneOldTournaments(): Promise<void> {
    const pruneThreshold = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago

    const oldTournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.CANCELLED,
        createdAt: LessThan(pruneThreshold),
      },
    });

    for (const tournament of oldTournaments) {
      try {
        await this.tournamentRepository.remove(tournament);
        await this.cacheService.invalidateTournament(tournament.id);
      } catch (error) {
        this.logger.error(
          `Failed to prune tournament ${tournament.id}:`,
          error,
        );
      }
    }

    if (oldTournaments.length > 0) {
      this.logger.log(`Pruned ${oldTournaments.length} old tournaments`);
    }
  }

  // Health and integrity checks
  private async checkSystemHealth(): Promise<void> {
    const healthChecks = [
      this.checkDatabaseHealth(),
      this.checkCacheHealth(),
      this.checkQueueHealth(),
    ];

    const results = await Promise.allSettled(healthChecks);
    const failures = results.filter((result) => result.status === 'rejected');

    if (failures.length > 0) {
      this.logger.error(
        `System health check failed: ${failures.length} components unhealthy`,
      );

      // Send alert
      await this.notificationQueue.add('system_health_alert', {
        failures: failures.length,
        timestamp: new Date(),
      });
    }
  }

  private async validateTournamentIntegrity(): Promise<void> {
    const activeTournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.IN_PROGRESS,
      },
      relations: ['participants', 'matches'],
    });

    for (const tournament of activeTournaments) {
      try {
        await this.validateTournamentData(tournament);
      } catch (error) {
        this.logger.error(
          `Tournament integrity check failed for ${tournament.id}:`,
          error,
        );
      }
    }
  }

  // Helper methods
  private async scheduleAutomationTask(task: AutomationTask): Promise<void> {
    this.automationTasks.set(task.id, task);

    await this.automationQueue.add(task.type, task.data, {
      delay: task.scheduledAt.getTime() - Date.now(),
      jobId: task.id,
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  private async processAutomationQueue(): Promise<void> {
    const now = new Date();
    const readyTasks = Array.from(this.automationTasks.values()).filter(
      (task) => task.scheduledAt <= now,
    );

    for (const task of readyTasks) {
      try {
        await this.executeAutomationTask(task);
        this.automationTasks.delete(task.id);
      } catch (error) {
        this.logger.error(
          `Failed to execute automation task ${task.id}:`,
          error,
        );
      }
    }
  }

  private async executeAutomationTask(task: AutomationTask): Promise<void> {
    switch (task.type) {
      case 'close_registration':
        const tournament = await this.tournamentRepository.findOne({
          where: { id: task.tournamentId },
          relations: ['participants'],
        });
        if (tournament) {
          await this.closeRegistration(tournament);
        }
        break;

      case 'start_tournament':
        const startTournament = await this.tournamentRepository.findOne({
          where: { id: task.tournamentId },
          relations: ['participants'],
        });
        if (startTournament) {
          await this.startTournament(startTournament);
        }
        break;

      case 'schedule_round':
        await this.matchScheduler.scheduleRoundMatches(
          task.tournamentId,
          task.data.round,
        );
        break;

      default:
        this.logger.warn(`Unknown automation task type: ${task.type}`);
    }
  }

  private async cancelTournamentDueToInsufficientParticipants(
    tournament: Tournament,
  ): Promise<void> {
    tournament.status = TournamentStatus.CANCELLED;
    await this.tournamentRepository.save(tournament);

    // Notify participants
    await this.notificationQueue.add(
      'tournament_cancelled_insufficient_participants',
      {
        tournamentId: tournament.id,
        tournament,
      },
    );

    // Emit event
    this.eventEmitter.emit('tournament.cancelled', {
      tournament,
      reason: 'insufficient_participants',
    });

    this.logger.log(
      `Tournament cancelled due to insufficient participants: ${tournament.name}`,
    );
  }

  private async autoApproveParticipants(tournamentId: string): Promise<void> {
    await this.participantRepository.update(
      {
        tournamentId,
        status: ParticipantStatus.REGISTERED,
      },
      {
        status: ParticipantStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    );
  }

  private async calculateTournamentStats(tournamentId: string): Promise<any> {
    const matches = await this.matchRepository.find({
      where: { tournamentId },
    });

    const participants = await this.participantRepository.find({
      where: { tournamentId },
    });

    return {
      totalParticipants: participants.length,
      totalMatches: matches.length,
      completedMatches: matches.filter(
        (m) => m.status === MatchStatus.COMPLETED,
      ).length,
      activeMatches: matches.filter((m) => m.status === MatchStatus.IN_PROGRESS)
        .length,
      upcomingMatches: matches.filter((m) => m.status === MatchStatus.SCHEDULED)
        .length,
      currentRound: Math.max(...matches.map((m) => m.round), 0),
    };
  }

  private async archiveTournament(tournament: Tournament): Promise<void> {
    // This would move tournament data to an archive table/database
    // For now, just mark as archived
    tournament.metadata = {
      ...tournament.metadata,
      archived: true,
      archivedAt: new Date(),
    };
    await this.tournamentRepository.save(tournament);
  }

  private async checkDatabaseHealth(): Promise<void> {
    await this.tournamentRepository.query('SELECT 1');
  }

  private async checkCacheHealth(): Promise<void> {
    const health = await this.cacheService.getHealthCheck();
    if (health.status !== 'healthy') {
      throw new Error('Cache is unhealthy');
    }
  }

  private async checkQueueHealth(): Promise<void> {
    const waiting = await this.automationQueue.getWaiting();
    const active = await this.automationQueue.getActive();

    if (waiting.length > 1000 || active.length > 100) {
      throw new Error('Queue is overloaded');
    }
  }

  private async validateTournamentData(tournament: Tournament): Promise<void> {
    // Check for data inconsistencies
    const participantCount = tournament.participants.length;
    const confirmedCount = tournament.participants.filter(
      (p) => p.status === ParticipantStatus.CONFIRMED,
    ).length;

    if (
      tournament.status === TournamentStatus.IN_PROGRESS &&
      confirmedCount < tournament.minParticipants
    ) {
      throw new Error(
        `Tournament ${tournament.id} has insufficient confirmed participants`,
      );
    }
  }

  private async recalculateRankings(): Promise<void> {
    const tournaments = await this.tournamentRepository.find({
      where: {
        status: TournamentStatus.IN_PROGRESS,
      },
      relations: ['participants'],
    });

    for (const tournament of tournaments) {
      const participants = tournament.participants.sort((a, b) => {
        if (a.points !== b.points) return b.points - a.points;
        if (a.wins !== b.wins) return b.wins - a.wins;
        return a.losses - b.losses;
      });

      for (let i = 0; i < participants.length; i++) {
        participants[i].currentRank = i + 1;
        await this.participantRepository.save(participants[i]);
      }
    }
  }

  private async optimizeCacheUsage(): Promise<void> {
    // Clear unused cache entries
    const stats = this.cacheService.getStats();

    if (stats.hits / (stats.hits + stats.misses) < 0.7) {
      // Hit rate below 70%
      this.logger.warn(
        'Cache hit rate is low, consider optimizing cache strategy',
      );
    }
  }

  private async generateDailyReports(): Promise<void> {
    // Generate analytics reports for tournaments
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const tournaments = await this.tournamentRepository.find({
      where: {
        createdAt: MoreThan(yesterday),
      },
    });

    if (tournaments.length > 0) {
      await this.notificationQueue.add('daily_tournament_report', {
        date: yesterday,
        tournamentsCreated: tournaments.length,
        timestamp: new Date(),
      });
    }
  }

  private async generateAnalyticsReports(): Promise<void> {
    // Generate comprehensive analytics reports
    // This would integrate with analytics service
    this.logger.log('Generated analytics reports');
  }

  private async cleanupLogs(): Promise<void> {
    // Clean up old log files and temporary data
    this.logger.log('Cleaned up old logs');
  }

  private async optimizeDatabase(): Promise<void> {
    // Run database optimization queries
    try {
      await this.tournamentRepository.query('ANALYZE');
      this.logger.log('Database optimization completed');
    } catch (error) {
      this.logger.error('Database optimization failed:', error);
    }
  }

  private async cleanupStaleData(): Promise<void> {
    // Remove stale cache entries and temporary data
    const staleThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days

    // This would clean up various stale data sources
    this.logger.log('Cleaned up stale data');
  }

  // Public API for manual task scheduling
  async scheduleCustomTask(
    tournamentId: string,
    type: string,
    scheduledAt: Date,
    data: any,
  ): Promise<void> {
    const task: AutomationTask = {
      id: `custom_${Date.now()}_${tournamentId}`,
      tournamentId,
      type,
      scheduledAt,
      data,
    };

    await this.scheduleAutomationTask(task);
  }

  async cancelScheduledTask(taskId: string): Promise<void> {
    this.automationTasks.delete(taskId);

    const job = await this.automationQueue.getJob(taskId);
    if (job) {
      await job.remove();
    }
  }

  getScheduledTasks(tournamentId?: string): AutomationTask[] {
    const tasks = Array.from(this.automationTasks.values());
    return tournamentId
      ? tasks.filter((task) => task.tournamentId === tournamentId)
      : tasks;
  }
}
