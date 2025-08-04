import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from '../entities/tournament.entity';
import { TournamentParticipant } from '../entities/tournament-participant.entity';
import { ITournamentEligibilityCheck } from '../interfaces/tournament.interfaces';
import { TournamentStatus, ParticipantStatus } from '../enums/tournament.enums';

interface EligibilityRule {
  name: string;
  check: (playerId: string, tournament: Tournament) => Promise<boolean>;
  reason: string;
}

@Injectable()
export class TournamentEligibilityService
  implements ITournamentEligibilityCheck
{
  constructor(
    @InjectRepository(Tournament)
    private tournamentRepository: Repository<Tournament>,
    @InjectRepository(TournamentParticipant)
    private participantRepository: Repository<TournamentParticipant>,
  ) {}

  async isEligible(playerId: string, tournamentId: string): Promise<boolean> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
      relations: ['participants'],
    });

    if (!tournament) {
      return false;
    }

    const rules = this.getEligibilityRules();

    for (const rule of rules) {
      const isRulePassed = await rule.check(playerId, tournament);
      if (!isRulePassed) {
        return false;
      }
    }

    return true;
  }

  async getEligibilityReason(
    playerId: string,
    tournamentId: string,
  ): Promise<string> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
      relations: ['participants'],
    });

    if (!tournament) {
      return 'Tournament not found';
    }

    const rules = this.getEligibilityRules();

    for (const rule of rules) {
      const isRulePassed = await rule.check(playerId, tournament);
      if (!isRulePassed) {
        return rule.reason;
      }
    }

    return 'Player is eligible';
  }

  private getEligibilityRules(): EligibilityRule[] {
    return [
      {
        name: 'registration_open',
        check: async (playerId: string, tournament: Tournament) => {
          return tournament.canRegister;
        },
        reason: 'Tournament registration is not open',
      },
      {
        name: 'not_full',
        check: async (playerId: string, tournament: Tournament) => {
          return !tournament.isFull;
        },
        reason: 'Tournament is full',
      },
      {
        name: 'not_already_registered',
        check: async (playerId: string, tournament: Tournament) => {
          const existingParticipant = tournament.participants.find(
            (p) => p.playerId === playerId,
          );
          return !existingParticipant;
        },
        reason: 'Player is already registered for this tournament',
      },
      {
        name: 'not_banned',
        check: async (playerId: string, tournament: Tournament) => {
          return this.checkPlayerNotBanned(playerId, tournament);
        },
        reason: 'Player is banned from tournaments',
      },
      {
        name: 'age_restriction',
        check: async (playerId: string, tournament: Tournament) => {
          return this.checkAgeRestriction(playerId, tournament);
        },
        reason: 'Player does not meet age requirements',
      },
      {
        name: 'skill_level',
        check: async (playerId: string, tournament: Tournament) => {
          return this.checkSkillLevel(playerId, tournament);
        },
        reason: 'Player does not meet skill level requirements',
      },
      {
        name: 'geographic_restriction',
        check: async (playerId: string, tournament: Tournament) => {
          return this.checkGeographicRestriction(playerId, tournament);
        },
        reason: 'Player is not from an eligible region',
      },
      {
        name: 'team_size_limit',
        check: async (playerId: string, tournament: Tournament) => {
          return this.checkTeamSizeLimit(playerId, tournament);
        },
        reason: 'Team size exceeds tournament limits',
      },
      {
        name: 'concurrent_tournament_limit',
        check: async (playerId: string, tournament: Tournament) => {
          return this.checkConcurrentTournamentLimit(playerId);
        },
        reason: 'Player is participating in too many concurrent tournaments',
      },
      {
        name: 'entry_fee_paid',
        check: async (playerId: string, tournament: Tournament) => {
          return this.checkEntryFeePaid(playerId, tournament);
        },
        reason: 'Entry fee has not been paid',
      },
      {
        name: 'verification_status',
        check: async (playerId: string, tournament: Tournament) => {
          return this.checkVerificationStatus(playerId, tournament);
        },
        reason: 'Player account is not verified',
      },
    ];
  }

  private async checkPlayerNotBanned(
    playerId: string,
    tournament: Tournament,
  ): Promise<boolean> {
    // Check if player is banned from tournaments
    // This would integrate with a moderation system
    const banKey = (tournament.settings?.banList as string[]) || [];
    return !banKey.includes(playerId);
  }

  private async checkAgeRestriction(
    playerId: string,
    tournament: Tournament,
  ): Promise<boolean> {
    const minAge = tournament.settings?.minAge as number;
    const maxAge = tournament.settings?.maxAge as number;

    if (!minAge && !maxAge) {
      return true; // No age restrictions
    }

    // This would fetch player's age from user service
    const playerAge = await this.getPlayerAge(playerId);

    if (minAge && playerAge < minAge) {
      return false;
    }

    if (maxAge && playerAge > maxAge) {
      return false;
    }

    return true;
  }

  private async checkSkillLevel(
    playerId: string,
    tournament: Tournament,
  ): Promise<boolean> {
    const minSkillLevel = tournament.settings?.minSkillLevel as number;
    const maxSkillLevel = tournament.settings?.maxSkillLevel as number;

    if (!minSkillLevel && !maxSkillLevel) {
      return true; // No skill restrictions
    }

    // This would fetch player's skill rating from user stats service
    const playerSkillLevel = await this.getPlayerSkillLevel(playerId);

    if (minSkillLevel && playerSkillLevel < minSkillLevel) {
      return false;
    }

    if (maxSkillLevel && playerSkillLevel > maxSkillLevel) {
      return false;
    }

    return true;
  }

  private async checkGeographicRestriction(
    playerId: string,
    tournament: Tournament,
  ): Promise<boolean> {
    const allowedRegions = tournament.settings?.allowedRegions as string[];
    const blockedRegions = tournament.settings?.blockedRegions as string[];

    if (!allowedRegions && !blockedRegions) {
      return true; // No geographic restrictions
    }

    // This would fetch player's region from user service
    const playerRegion = await this.getPlayerRegion(playerId);

    if (allowedRegions && !allowedRegions.includes(playerRegion)) {
      return false;
    }

    if (blockedRegions && blockedRegions.includes(playerRegion)) {
      return false;
    }

    return true;
  }

  private async checkTeamSizeLimit(
    playerId: string,
    tournament: Tournament,
  ): Promise<boolean> {
    const maxTeamSize = tournament.settings?.maxTeamSize as number;

    if (!maxTeamSize) {
      return true; // No team size restrictions
    }

    // This would check the team size if it's a team tournament
    const teamSize = await this.getPlayerTeamSize(playerId);

    return teamSize <= maxTeamSize;
  }

  private async checkConcurrentTournamentLimit(
    playerId: string,
  ): Promise<boolean> {
    const maxConcurrentTournaments = 5; // Configurable limit

    const activeTournaments = await this.participantRepository.count({
      where: {
        playerId,
        status: ParticipantStatus.ACTIVE,
      },
      relations: ['tournament'],
    });

    return activeTournaments < maxConcurrentTournaments;
  }

  private async checkEntryFeePaid(
    playerId: string,
    tournament: Tournament,
  ): Promise<boolean> {
    if (!tournament.entryFee || tournament.entryFee === 0) {
      return true; // No entry fee required
    }

    // This would check payment status from payment service
    return this.hasPlayerPaidEntryFee(playerId, tournament.id);
  }

  private async checkVerificationStatus(
    playerId: string,
    tournament: Tournament,
  ): Promise<boolean> {
    const requiresVerification = tournament.settings
      ?.requiresVerification as boolean;

    if (!requiresVerification) {
      return true;
    }

    // This would check verification status from user service
    return this.isPlayerVerified(playerId);
  }

  // Mock implementations - would integrate with actual services
  private async getPlayerAge(playerId: string): Promise<number> {
    // Mock implementation
    return 25;
  }

  private async getPlayerSkillLevel(playerId: string): Promise<number> {
    // Mock implementation - would fetch from user stats service
    return 1500; // ELO rating
  }

  private async getPlayerRegion(playerId: string): Promise<string> {
    // Mock implementation
    return 'US';
  }

  private async getPlayerTeamSize(playerId: string): Promise<number> {
    // Mock implementation
    return 1;
  }

  private async hasPlayerPaidEntryFee(
    playerId: string,
    tournamentId: string,
  ): Promise<boolean> {
    // Mock implementation - would check payment service
    return true;
  }

  private async isPlayerVerified(playerId: string): Promise<boolean> {
    // Mock implementation - would check user service
    return true;
  }

  async getDetailedEligibilityReport(
    playerId: string,
    tournamentId: string,
  ): Promise<{
    isEligible: boolean;
    passedRules: string[];
    failedRules: Array<{ name: string; reason: string }>;
  }> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
      relations: ['participants'],
    });

    const report = {
      isEligible: true,
      passedRules: [] as string[],
      failedRules: [] as Array<{ name: string; reason: string }>,
    };

    if (!tournament) {
      report.isEligible = false;
      report.failedRules.push({
        name: 'tournament_exists',
        reason: 'Tournament not found',
      });
      return report;
    }

    const rules = this.getEligibilityRules();

    for (const rule of rules) {
      const isRulePassed = await rule.check(playerId, tournament);
      if (isRulePassed) {
        report.passedRules.push(rule.name);
      } else {
        report.failedRules.push({ name: rule.name, reason: rule.reason });
        report.isEligible = false;
      }
    }

    return report;
  }

  async canPlayerJoinTournament(
    playerId: string,
    tournamentId: string,
    bypassChecks: string[] = [],
  ): Promise<{ canJoin: boolean; reason?: string }> {
    const tournament = await this.tournamentRepository.findOne({
      where: { id: tournamentId },
      relations: ['participants'],
    });

    if (!tournament) {
      return { canJoin: false, reason: 'Tournament not found' };
    }

    const rules = this.getEligibilityRules().filter(
      (rule) => !bypassChecks.includes(rule.name),
    );

    for (const rule of rules) {
      const isRulePassed = await rule.check(playerId, tournament);
      if (!isRulePassed) {
        return { canJoin: false, reason: rule.reason };
      }
    }

    return { canJoin: true };
  }
}
