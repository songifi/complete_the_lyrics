import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Match } from '../entities/match.entity';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { TournamentCacheService } from './tournament-cache.service';
import {
  IMatchScheduler,
  ITournament,
  IBracketMatch,
} from '../interfaces/tournament.interfaces';
import { MatchStatus, TournamentStatus } from '../enums/tournament.enums';

interface SchedulingConstraint {
  participantId: string;
  busySlots: Date[];
  preferredSlots: Date[];
  timeZone: string;
}

interface ScheduledMatch {
  matchId: string;
  scheduledAt: Date;
  estimatedDuration: number;
  participants: string[];
}

@Injectable()
export class MatchSchedulerService implements IMatchScheduler {
  constructor(
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(Tournament)
    private tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentParticipant)
    private participantRepository: Repository<TournamentParticipant>,
    @InjectQueue('match-processing')
    private matchQueue: Queue,
    private dataSource: DataSource,
    private eventEmitter: EventEmitter2,
    private cacheService: TournamentCacheService,
  ) {}

  async scheduleMatch(
    match: IBracketMatch,
    tournament: ITournament,
  ): Promise<Date> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Get participant constraints
      const constraints = await this.getParticipantConstraints(
        [match.homeParticipantId, match.awayParticipantId].filter(Boolean),
      );

      // Find optimal time slot
      const scheduledTime = this.findOptimalTimeSlot(tournament, constraints);

      // Update match in database
      await queryRunner.manager.update(
        Match,
        { id: match.id },
        {
          scheduledAt: scheduledTime,
          status: MatchStatus.SCHEDULED,
        },
      );

      // Schedule match processing job
      await this.scheduleMatchProcessingJob(match.id, scheduledTime);

      // Cache the scheduled match
      await this.cacheService.cacheActiveMatches(tournament.id, [match.id]);

      await queryRunner.commitTransaction();

      // Emit scheduling event
      this.eventEmitter.emit('match.scheduled', {
        matchId: match.id,
        tournamentId: tournament.id,
        scheduledAt: scheduledTime,
      });

      return scheduledTime;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async rescheduleMatch(matchId: string, newDate: Date): Promise<boolean> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const match = await this.matchRepository.findOne({
        where: { id: matchId },
        relations: ['homeParticipant', 'awayParticipant', 'tournament'],
      });

      if (!match) {
        throw new BadRequestException('Match not found');
      }

      if (
        match.status === MatchStatus.IN_PROGRESS ||
        match.status === MatchStatus.COMPLETED
      ) {
        throw new BadRequestException(
          'Cannot reschedule match that is in progress or completed',
        );
      }

      // Check if new time is available
      const constraints = await this.getParticipantConstraints(
        [match.homeParticipantId, match.awayParticipantId].filter(Boolean),
      );

      const isTimeAvailable = this.isTimeSlotAvailable(newDate, constraints);
      if (!isTimeAvailable) {
        return false;
      }

      // Update match
      match.scheduledAt = newDate;
      await queryRunner.manager.save(match);

      // Cancel existing job and create new one
      await this.cancelMatchProcessingJob(matchId);
      await this.scheduleMatchProcessingJob(matchId, newDate);

      await queryRunner.commitTransaction();

      // Emit rescheduling event
      this.eventEmitter.emit('match.rescheduled', {
        matchId,
        oldDate: match.scheduledAt,
        newDate,
        tournamentId: match.tournamentId,
      });

      return true;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  getAvailableTimeSlots(tournamentId: string, date: Date): Date[] {
    const slots: Date[] = [];
    const startTime = new Date(date);
    startTime.setHours(9, 0, 0, 0); // Start at 9 AM

    const endTime = new Date(date);
    endTime.setHours(21, 0, 0, 0); // End at 9 PM

    // Generate 30-minute time slots
    const current = new Date(startTime);
    while (current <= endTime) {
      slots.push(new Date(current));
      current.setMinutes(current.getMinutes() + 30);
    }

    return slots;
  }

  async scheduleRoundMatches(
    tournamentId: string,
    round: number,
  ): Promise<ScheduledMatch[]> {
    const matches = await this.matchRepository.find({
      where: {
        tournamentId,
        round,
        status: MatchStatus.SCHEDULED,
      },
      relations: ['homeParticipant', 'awayParticipant', 'tournament'],
    });

    const tournament = matches[0]?.tournament;
    if (!tournament) {
      throw new BadRequestException('Tournament not found');
    }

    const scheduledMatches: ScheduledMatch[] = [];

    // Schedule matches with spacing to avoid conflicts
    let currentTime = this.calculateRoundStartTime(tournament, round);

    for (const match of matches) {
      const participants = [
        match.homeParticipantId,
        match.awayParticipantId,
      ].filter(Boolean);
      const constraints = await this.getParticipantConstraints(participants);

      // Find next available slot starting from currentTime
      const scheduledTime = this.findNextAvailableSlot(
        currentTime,
        constraints,
      );

      // Update match
      await this.matchRepository.update(match.id, {
        scheduledAt: scheduledTime,
      });

      // Schedule processing job
      await this.scheduleMatchProcessingJob(match.id, scheduledTime);

      scheduledMatches.push({
        matchId: match.id,
        scheduledAt: scheduledTime,
        estimatedDuration: tournament.settings?.matchDuration || 60, // minutes
        participants,
      });

      // Add buffer time between matches
      currentTime = new Date(scheduledTime.getTime() + 90 * 60 * 1000); // 90 minutes later
    }

    // Cache scheduled matches
    await this.cacheService.cacheActiveMatches(
      tournamentId,
      scheduledMatches.map((m) => m.matchId),
    );

    return scheduledMatches;
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledMatches(): Promise<void> {
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    // Find matches that should start within the next 5 minutes
    const upcomingMatches = await this.matchRepository.find({
      where: {
        status: MatchStatus.SCHEDULED,
      },
      relations: ['tournament', 'homeParticipant', 'awayParticipant'],
    });

    const matchesToStart = upcomingMatches.filter((match) => {
      return (
        match.scheduledAt &&
        match.scheduledAt >= now &&
        match.scheduledAt <= fiveMinutesFromNow
      );
    });

    for (const match of matchesToStart) {
      await this.startMatch(match);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredSchedules(): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Find and clean up old scheduled matches that never started
    const expiredMatches = await this.matchRepository.find({
      where: {
        status: MatchStatus.SCHEDULED,
      },
    });

    const expired = expiredMatches.filter(
      (match) => match.scheduledAt && match.scheduledAt < oneDayAgo,
    );

    for (const match of expired) {
      // Cancel the match or mark as no-show
      await this.handleExpiredMatch(match);
    }
  }

  private async getParticipantConstraints(
    participantIds: string[],
  ): Promise<SchedulingConstraint[]> {
    const constraints: SchedulingConstraint[] = [];

    for (const participantId of participantIds) {
      if (!participantId) continue;

      // This would fetch participant availability from user service
      const constraint: SchedulingConstraint = {
        participantId,
        busySlots: await this.getParticipantBusySlots(participantId),
        preferredSlots: await this.getParticipantPreferredSlots(participantId),
        timeZone: await this.getParticipantTimeZone(participantId),
      };

      constraints.push(constraint);
    }

    return constraints;
  }

  private findOptimalTimeSlot(
    tournament: ITournament,
    constraints: SchedulingConstraint[],
  ): Date {
    const now = new Date();
    const startSearchFrom = new Date(
      Math.max(now.getTime(), Date.now() + 30 * 60 * 1000),
    ); // At least 30 minutes from now

    // Generate potential time slots for the next 7 days
    const potentialSlots = this.generatePotentialSlots(startSearchFrom, 7);

    // Score each slot based on constraints
    let bestSlot = potentialSlots[0];
    let bestScore = -1;

    for (const slot of potentialSlots) {
      const score = this.scoreTimeSlot(slot, constraints);
      if (score > bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }

  private generatePotentialSlots(startFrom: Date, days: number): Date[] {
    const slots: Date[] = [];
    const current = new Date(startFrom);

    for (let day = 0; day < days; day++) {
      // Generate slots for each day (9 AM to 9 PM, every 30 minutes)
      for (let hour = 9; hour <= 21; hour++) {
        for (let minute = 0; minute < 60; minute += 30) {
          const slot = new Date(current);
          slot.setHours(hour, minute, 0, 0);
          slots.push(slot);
        }
      }
      current.setDate(current.getDate() + 1);
    }

    return slots;
  }

  private scoreTimeSlot(
    slot: Date,
    constraints: SchedulingConstraint[],
  ): number {
    let score = 100; // Base score

    for (const constraint of constraints) {
      // Check if slot conflicts with busy times
      const isBusy = constraint.busySlots.some(
        (busySlot) =>
          Math.abs(slot.getTime() - busySlot.getTime()) < 2 * 60 * 60 * 1000, // 2 hour buffer
      );

      if (isBusy) {
        score -= 50;
      }

      // Bonus for preferred times
      const isPreferred = constraint.preferredSlots.some(
        (prefSlot) =>
          Math.abs(slot.getTime() - prefSlot.getTime()) < 1 * 60 * 60 * 1000, // 1 hour window
      );

      if (isPreferred) {
        score += 25;
      }

      // Time zone considerations
      const localHour = this.convertToTimeZone(
        slot,
        constraint.timeZone,
      ).getHours();
      if (localHour >= 9 && localHour <= 21) {
        score += 10; // Good time in participant's timezone
      } else {
        score -= 30; // Poor time in participant's timezone
      }
    }

    return score;
  }

  private isTimeSlotAvailable(
    slot: Date,
    constraints: SchedulingConstraint[],
  ): boolean {
    for (const constraint of constraints) {
      const isBusy = constraint.busySlots.some(
        (busySlot) =>
          Math.abs(slot.getTime() - busySlot.getTime()) < 1 * 60 * 60 * 1000,
      );

      if (isBusy) {
        return false;
      }
    }

    return true;
  }

  private findNextAvailableSlot(
    startFrom: Date,
    constraints: SchedulingConstraint[],
  ): Date {
    const slots = this.generatePotentialSlots(startFrom, 7);

    for (const slot of slots) {
      if (this.isTimeSlotAvailable(slot, constraints)) {
        return slot;
      }
    }

    // If no slot is available, return the first potential slot
    return slots[0];
  }

  private calculateRoundStartTime(tournament: Tournament, round: number): Date {
    const baseStartTime = tournament.startAt;
    const roundDuration =
      (tournament.settings?.roundDuration as number) || 3 * 60 * 60 * 1000; // 3 hours default

    return new Date(baseStartTime.getTime() + (round - 1) * roundDuration);
  }

  private async scheduleMatchProcessingJob(
    matchId: string,
    scheduledAt: Date,
  ): Promise<void> {
    const delay = scheduledAt.getTime() - Date.now();

    if (delay > 0) {
      await this.matchQueue.add(
        'start-match',
        { matchId },
        {
          delay,
          jobId: `match-${matchId}`,
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    }
  }

  private async cancelMatchProcessingJob(matchId: string): Promise<void> {
    const job = await this.matchQueue.getJob(`match-${matchId}`);
    if (job) {
      await job.remove();
    }
  }

  private async startMatch(match: Match): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update match status
      match.status = MatchStatus.IN_PROGRESS;
      match.startedAt = new Date();
      await queryRunner.manager.save(match);

      // Schedule auto-completion if match doesn't complete naturally
      const autoCompleteDelay =
        ((match.tournament.settings?.matchDuration as number) || 60) *
        60 *
        1000;
      await this.matchQueue.add(
        'auto-complete-match',
        { matchId: match.id },
        {
          delay: autoCompleteDelay,
          jobId: `auto-complete-${match.id}`,
        },
      );

      await queryRunner.commitTransaction();

      // Emit match started event
      this.eventEmitter.emit('match.started', {
        matchId: match.id,
        tournamentId: match.tournamentId,
        startedAt: match.startedAt,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async handleExpiredMatch(match: Match): Promise<void> {
    // Mark as cancelled or handle no-show
    await this.matchRepository.update(match.id, {
      status: MatchStatus.CANCELLED,
      notes: 'Match expired - no participants showed up',
    });

    this.eventEmitter.emit('match.expired', {
      matchId: match.id,
      tournamentId: match.tournamentId,
    });
  }

  // Mock implementations - would integrate with actual services
  private async getParticipantBusySlots(
    participantId: string,
  ): Promise<Date[]> {
    // Would fetch from user calendar/availability service
    return [];
  }

  private async getParticipantPreferredSlots(
    participantId: string,
  ): Promise<Date[]> {
    // Would fetch from user preferences
    return [];
  }

  private async getParticipantTimeZone(participantId: string): Promise<string> {
    // Would fetch from user profile
    return 'UTC';
  }

  private convertToTimeZone(date: Date, timeZone: string): Date {
    // Simple implementation - would use proper timezone library
    return new Date(date.toLocaleString('en-US', { timeZone }));
  }

  async getMatchSchedule(tournamentId: string): Promise<ScheduledMatch[]> {
    const matches = await this.matchRepository.find({
      where: { tournamentId },
      relations: ['homeParticipant', 'awayParticipant'],
      order: { scheduledAt: 'ASC' },
    });

    return matches.map((match) => ({
      matchId: match.id,
      scheduledAt: match.scheduledAt || new Date(),
      estimatedDuration: 60, // Default duration
      participants: [match.homeParticipantId, match.awayParticipantId].filter(
        Boolean,
      ),
    }));
  }

  async updateMatchDuration(matchId: string, duration: number): Promise<void> {
    await this.matchRepository.update(matchId, {
      metadata: { estimatedDuration: duration },
    });
  }

  async getParticipantSchedule(
    participantId: string,
  ): Promise<ScheduledMatch[]> {
    const matches = await this.matchRepository.find({
      where: [
        { homeParticipantId: participantId },
        { awayParticipantId: participantId },
      ],
      order: { scheduledAt: 'ASC' },
    });

    return matches.map((match) => ({
      matchId: match.id,
      scheduledAt: match.scheduledAt || new Date(),
      estimatedDuration: 60,
      participants: [match.homeParticipantId, match.awayParticipantId].filter(
        Boolean,
      ),
    }));
  }
}
