import { Injectable } from '@nestjs/common';
import {
  IPrizeCalculator,
  ITournament,
  ITournamentParticipant,
  IPrizeDistribution,
} from '../interfaces/tournament.interfaces';
import { PrizeType, TournamentFormat } from '../enums/tournament.enums';

interface PrizeStructure {
  rank: number;
  percentage?: number;
  fixedAmount?: number;
  prizeType: PrizeType;
  prizeData?: Record<string, any>;
}

@Injectable()
export class PrizeCalculatorService implements IPrizeCalculator {
  calculatePrizes(
    tournament: ITournament,
    participants: ITournamentParticipant[],
  ): IPrizeDistribution[] {
    const sortedParticipants = this.sortParticipantsByRank(participants);
    const prizeStructure = this.getPrizeStructure(
      tournament,
      sortedParticipants.length,
    );

    return this.distributePrizes(
      tournament,
      prizeStructure,
      sortedParticipants,
    );
  }

  private sortParticipantsByRank(
    participants: ITournamentParticipant[],
  ): ITournamentParticipant[] {
    return [...participants].sort((a, b) => {
      // Primary sort by points (highest first)
      if (a.points !== b.points) {
        return b.points - a.points;
      }

      // Secondary sort by wins
      if (a.wins !== b.wins) {
        return b.wins - a.wins;
      }

      // Tertiary sort by losses (fewer losses is better)
      if (a.losses !== b.losses) {
        return a.losses - b.losses;
      }

      // Final tiebreaker by draws
      return b.draws - a.draws;
    });
  }

  private getPrizeStructure(
    tournament: ITournament,
    participantCount: number,
  ): PrizeStructure[] {
    const customStructure = tournament.settings
      ?.prizeStructure as PrizeStructure[];

    if (customStructure) {
      return customStructure;
    }

    // Default prize structures based on tournament format and size
    switch (tournament.format) {
      case TournamentFormat.SINGLE_ELIMINATION:
        return this.getSingleEliminationPrizeStructure(participantCount);
      case TournamentFormat.DOUBLE_ELIMINATION:
        return this.getDoubleEliminationPrizeStructure(participantCount);
      case TournamentFormat.ROUND_ROBIN:
        return this.getRoundRobinPrizeStructure(participantCount);
      case TournamentFormat.SWISS_SYSTEM:
        return this.getSwissPrizeStructure(participantCount);
      default:
        return this.getDefaultPrizeStructure(participantCount);
    }
  }

  private getSingleEliminationPrizeStructure(
    participantCount: number,
  ): PrizeStructure[] {
    if (participantCount < 4) {
      return [{ rank: 1, percentage: 100, prizeType: PrizeType.CASH }];
    } else if (participantCount < 8) {
      return [
        { rank: 1, percentage: 70, prizeType: PrizeType.CASH },
        { rank: 2, percentage: 30, prizeType: PrizeType.CASH },
      ];
    } else if (participantCount < 16) {
      return [
        { rank: 1, percentage: 50, prizeType: PrizeType.CASH },
        { rank: 2, percentage: 30, prizeType: PrizeType.CASH },
        { rank: 3, percentage: 20, prizeType: PrizeType.CASH },
      ];
    } else {
      return [
        { rank: 1, percentage: 40, prizeType: PrizeType.CASH },
        { rank: 2, percentage: 25, prizeType: PrizeType.CASH },
        { rank: 3, percentage: 15, prizeType: PrizeType.CASH },
        { rank: 4, percentage: 10, prizeType: PrizeType.CASH },
        { rank: 5, percentage: 5, prizeType: PrizeType.CASH },
        { rank: 6, percentage: 3, prizeType: PrizeType.CASH },
        { rank: 7, percentage: 1, prizeType: PrizeType.CASH },
        { rank: 8, percentage: 1, prizeType: PrizeType.CASH },
      ];
    }
  }

  private getDoubleEliminationPrizeStructure(
    participantCount: number,
  ): PrizeStructure[] {
    // Similar to single elimination but with slightly different percentages
    const structure = this.getSingleEliminationPrizeStructure(participantCount);

    // Adjust percentages for double elimination (more competitive)
    if (structure.length >= 2) {
      structure[0].percentage = 45; // Winner gets slightly less
      structure[1].percentage = 30; // Runner-up gets slightly more
    }

    return structure;
  }

  private getRoundRobinPrizeStructure(
    participantCount: number,
  ): PrizeStructure[] {
    const prizeCount = Math.min(Math.ceil(participantCount / 2), 8);
    const structure: PrizeStructure[] = [];

    // Distribute prizes more evenly in round robin
    const percentages = this.calculateEvenDistribution(prizeCount);

    for (let i = 0; i < prizeCount; i++) {
      structure.push({
        rank: i + 1,
        percentage: percentages[i],
        prizeType: PrizeType.CASH,
      });
    }

    return structure;
  }

  private getSwissPrizeStructure(participantCount: number): PrizeStructure[] {
    // Swiss tournaments often have flatter prize structures
    const prizeCount = Math.min(Math.ceil(participantCount / 3), 12);
    const structure: PrizeStructure[] = [];

    const percentages = this.calculateSwissDistribution(prizeCount);

    for (let i = 0; i < prizeCount; i++) {
      structure.push({
        rank: i + 1,
        percentage: percentages[i],
        prizeType: PrizeType.CASH,
      });
    }

    return structure;
  }

  private getDefaultPrizeStructure(participantCount: number): PrizeStructure[] {
    return this.getSingleEliminationPrizeStructure(participantCount);
  }

  private calculateEvenDistribution(prizeCount: number): number[] {
    const percentages: number[] = [];
    let remaining = 100;

    for (let i = 0; i < prizeCount; i++) {
      const weight = prizeCount - i;
      const totalWeight =
        (prizeCount * (prizeCount + 1)) / 2 - (i * (i + 1)) / 2;
      const percentage = Math.round((weight / totalWeight) * remaining);

      percentages.push(percentage);
      remaining -= percentage;
    }

    // Adjust last prize to use remaining percentage
    if (remaining > 0 && percentages.length > 0) {
      percentages[percentages.length - 1] += remaining;
    }

    return percentages;
  }

  private calculateSwissDistribution(prizeCount: number): number[] {
    const percentages: number[] = [];

    // Swiss system uses a flatter distribution
    const basePercentage = 70 / prizeCount;
    const bonusPool = 30;

    for (let i = 0; i < prizeCount; i++) {
      const bonus =
        (bonusPool * (prizeCount - i)) / ((prizeCount * (prizeCount + 1)) / 2);
      percentages.push(Math.round(basePercentage + bonus));
    }

    return percentages;
  }

  private distributePrizes(
    tournament: ITournament,
    prizeStructure: PrizeStructure[],
    sortedParticipants: ITournamentParticipant[],
  ): IPrizeDistribution[] {
    const prizes: IPrizeDistribution[] = [];
    const totalPrizePool = tournament.prizePool || 0;

    for (const prize of prizeStructure) {
      if (prize.rank <= sortedParticipants.length) {
        const participant = sortedParticipants[prize.rank - 1];

        let prizeAmount = 0;

        if (prize.percentage) {
          prizeAmount = (totalPrizePool * prize.percentage) / 100;
        } else if (prize.fixedAmount) {
          prizeAmount = prize.fixedAmount;
        }

        prizes.push({
          rank: prize.rank,
          prizeAmount,
          prizeType: prize.prizeType,
          prizeData: this.generatePrizeData(prize, participant),
          winnerId: participant.id,
        });
      }
    }

    return prizes;
  }

  private generatePrizeData(
    prize: PrizeStructure,
    participant: ITournamentParticipant,
  ): Record<string, any> {
    const data: Record<string, any> = {
      ...(prize.prizeData || {}),
      awardedAt: new Date().toISOString(),
      participantId: participant.id,
    };

    switch (prize.prizeType) {
      case PrizeType.TROPHY:
        data.trophyType = this.getTrophyType(prize.rank);
        break;
      case PrizeType.TITLE:
        data.title = this.getTitle(prize.rank);
        break;
      case PrizeType.ITEM:
        data.itemDetails = this.getItemDetails(prize.rank);
        break;
      case PrizeType.POINTS:
        data.pointsType = 'tournament_points';
        break;
    }

    return data;
  }

  private getTrophyType(rank: number): string {
    switch (rank) {
      case 1:
        return 'gold';
      case 2:
        return 'silver';
      case 3:
        return 'bronze';
      default:
        return 'participation';
    }
  }

  private getTitle(rank: number): string {
    switch (rank) {
      case 1:
        return 'Champion';
      case 2:
        return 'Runner-up';
      case 3:
        return 'Third Place';
      default:
        return 'Finalist';
    }
  }

  private getItemDetails(rank: number): Record<string, any> {
    // This would be customized based on the game/tournament type
    return {
      type: 'skin',
      rarity: rank <= 3 ? 'legendary' : 'epic',
      description: `Tournament reward for rank ${rank}`,
    };
  }

  calculateBonusPrizes(
    tournament: ITournament,
    participants: ITournamentParticipant[],
  ): IPrizeDistribution[] {
    const bonuses: IPrizeDistribution[] = [];

    // Performance bonuses
    const mostWins = Math.max(...participants.map((p) => p.wins));
    const bestPerformers = participants.filter((p) => p.wins === mostWins);

    if (bestPerformers.length === 1) {
      bonuses.push({
        rank: 0, // Special rank for bonuses
        prizeAmount: (tournament.prizePool || 0) * 0.05, // 5% bonus
        prizeType: PrizeType.CASH,
        prizeData: { bonusType: 'most_wins', wins: mostWins },
        winnerId: bestPerformers[0].id,
      });
    }

    // Sportsmanship bonus (would integrate with behavior tracking)
    const sportsmanshipWinner = this.calculateSportsmanshipWinner(participants);
    if (sportsmanshipWinner) {
      bonuses.push({
        rank: 0,
        prizeAmount: (tournament.prizePool || 0) * 0.02, // 2% bonus
        prizeType: PrizeType.POINTS,
        prizeData: { bonusType: 'sportsmanship' },
        winnerId: sportsmanshipWinner.id,
      });
    }

    return bonuses;
  }

  private calculateSportsmanshipWinner(
    participants: ITournamentParticipant[],
  ): ITournamentParticipant | null {
    // Mock implementation - would integrate with behavior/moderation system
    return participants[Math.floor(Math.random() * participants.length)];
  }

  calculateTeamPrizes(
    tournament: ITournament,
    participants: ITournamentParticipant[],
  ): IPrizeDistribution[] {
    // Group participants by team
    const teams = this.groupParticipantsByTeam(participants);
    const teamStandings = this.calculateTeamStandings(teams);

    // Calculate team prizes (similar to individual but distributed among team members)
    const teamPrizes: IPrizeDistribution[] = [];
    const teamPrizeStructure = this.getTeamPrizeStructure(teamStandings.length);

    for (
      let i = 0;
      i < teamPrizeStructure.length && i < teamStandings.length;
      i++
    ) {
      const team = teamStandings[i];
      const prizePerMember =
        ((tournament.prizePool || 0) * teamPrizeStructure[i].percentage) /
        100 /
        team.members.length;

      for (const member of team.members) {
        teamPrizes.push({
          rank: i + 1,
          prizeAmount: prizePerMember,
          prizeType: PrizeType.CASH,
          prizeData: { teamId: team.teamId, teamRank: i + 1 },
          winnerId: member.id,
        });
      }
    }

    return teamPrizes;
  }

  private groupParticipantsByTeam(
    participants: ITournamentParticipant[],
  ): Map<string, ITournamentParticipant[]> {
    const teams = new Map<string, ITournamentParticipant[]>();

    for (const participant of participants) {
      if (participant.teamId) {
        if (!teams.has(participant.teamId)) {
          teams.set(participant.teamId, []);
        }
        teams.get(participant.teamId)!.push(participant);
      }
    }

    return teams;
  }

  private calculateTeamStandings(
    teams: Map<string, ITournamentParticipant[]>,
  ): Array<{
    teamId: string;
    members: ITournamentParticipant[];
    totalPoints: number;
    totalWins: number;
  }> {
    const standings = Array.from(teams.entries()).map(([teamId, members]) => ({
      teamId,
      members,
      totalPoints: members.reduce((sum, member) => sum + member.points, 0),
      totalWins: members.reduce((sum, member) => sum + member.wins, 0),
    }));

    return standings.sort((a, b) => {
      if (a.totalPoints !== b.totalPoints) {
        return b.totalPoints - a.totalPoints;
      }
      return b.totalWins - a.totalWins;
    });
  }

  private getTeamPrizeStructure(teamCount: number): PrizeStructure[] {
    // Similar to individual prizes but adjusted for teams
    return this.getSingleEliminationPrizeStructure(teamCount);
  }
}
