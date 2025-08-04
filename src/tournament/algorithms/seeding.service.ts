import { Injectable } from '@nestjs/common';
import {
  ISeedingStrategy,
  ITournamentParticipant,
  ISeededParticipant,
} from '../interfaces/tournament.interfaces';

@Injectable()
export class SeedingService implements ISeedingStrategy {
  generateSeeds(
    participants: ITournamentParticipant[],
  ): ITournamentParticipant[] {
    return this.standardSeeding(participants);
  }

  /**
   * Standard tournament seeding - highest seeds paired with lowest
   */
  standardSeeding(
    participants: ITournamentParticipant[],
  ): ITournamentParticipant[] {
    const seeded = [...participants].sort((a, b) => {
      // Sort by existing seed if available, otherwise by ranking/skill
      const aSeed = a.seed || this.calculateImpliedSeed(a);
      const bSeed = b.seed || this.calculateImpliedSeed(b);
      return aSeed - bSeed;
    });

    // Assign seeds 1, 2, 3, etc.
    seeded.forEach((participant, index) => {
      participant.seed = index + 1;
    });

    return this.arrangeForOptimalBracket(seeded);
  }

  /**
   * Random seeding for casual tournaments
   */
  randomSeeding(
    participants: ITournamentParticipant[],
  ): ITournamentParticipant[] {
    const shuffled = [...participants];

    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Assign random seeds
    shuffled.forEach((participant, index) => {
      participant.seed = index + 1;
    });

    return shuffled;
  }

  /**
   * Skill-based seeding using player statistics
   */
  skillBasedSeeding(
    participants: ISeededParticipant[],
  ): ITournamentParticipant[] {
    const skillSorted = [...participants].sort((a, b) => {
      // Primary sort by skill rating
      if (a.skillRating && b.skillRating) {
        return b.skillRating - a.skillRating; // Descending
      }

      // Secondary sort by win rate
      const aWinRate = a.wins / (a.wins + a.losses + a.draws) || 0;
      const bWinRate = b.wins / (b.wins + b.losses + b.draws) || 0;

      if (aWinRate !== bWinRate) {
        return bWinRate - aWinRate; // Descending
      }

      // Tertiary sort by total points
      return b.points - a.points;
    });

    skillSorted.forEach((participant, index) => {
      participant.seed = index + 1;
    });

    return this.arrangeForOptimalBracket(skillSorted);
  }

  /**
   * Swiss system seeding based on current standings
   */
  swissSeeding(
    participants: ITournamentParticipant[],
    currentRound: number,
  ): ITournamentParticipant[] {
    if (currentRound === 1) {
      return this.standardSeeding(participants);
    }

    // Sort by points, then by tiebreakers
    const sorted = [...participants].sort((a, b) => {
      // Primary: Points
      if (a.points !== b.points) {
        return b.points - a.points;
      }

      // Secondary: Buchholz score (sum of opponents' points)
      const aBuchholz = this.calculateBuchholzScore(a);
      const bBuchholz = this.calculateBuchholzScore(b);
      if (aBuchholz !== bBuchholz) {
        return bBuchholz - aBuchholz;
      }

      // Tertiary: Sonneborn-Berger score
      const aSB = this.calculateSonnebornBergerScore(a);
      const bSB = this.calculateSonnebornBergerScore(b);
      return bSB - aSB;
    });

    return sorted;
  }

  /**
   * Arrange participants for optimal bracket structure
   * Places top seeds to avoid early meetups
   */
  private arrangeForOptimalBracket(
    seededParticipants: ITournamentParticipant[],
  ): ITournamentParticipant[] {
    const count = seededParticipants.length;
    const powerOf2 = Math.pow(2, Math.ceil(Math.log2(count)));

    // Standard tournament seeding arrangement
    const arranged: ITournamentParticipant[] = new Array(powerOf2).fill(null);

    // Place seeds in optimal positions
    for (let i = 0; i < seededParticipants.length; i++) {
      const position = this.getOptimalPosition(i + 1, powerOf2);
      arranged[position] = seededParticipants[i];
    }

    return arranged.filter((p) => p !== null);
  }

  /**
   * Calculate optimal position for a seed in the bracket
   */
  private getOptimalPosition(seed: number, bracketSize: number): number {
    if (seed === 1) return 0;
    if (seed === 2) return bracketSize - 1;

    // For other seeds, use recursive positioning
    const halvesSize = bracketSize / 2;
    const targetHalf = seed <= halvesSize ? 0 : 1;
    const relativePosition = seed <= halvesSize ? seed : seed - halvesSize;

    if (targetHalf === 0) {
      return this.getOptimalPosition(relativePosition, halvesSize);
    } else {
      return halvesSize + this.getOptimalPosition(relativePosition, halvesSize);
    }
  }

  /**
   * Calculate implied seed based on player statistics
   */
  private calculateImpliedSeed(participant: ITournamentParticipant): number {
    const totalGames =
      participant.wins + participant.losses + participant.draws;
    if (totalGames === 0) return 999; // Unrated players go last

    const winRate = participant.wins / totalGames;
    const adjustedPoints = participant.points + winRate * 100;

    return 1000 - adjustedPoints; // Lower score = better seed
  }

  /**
   * Calculate Buchholz score (sum of opponents' points)
   * Used as tiebreaker in Swiss system
   */
  private calculateBuchholzScore(participant: ITournamentParticipant): number {
    // This would need access to match history and opponents
    // Simplified implementation
    return participant.metadata?.buchholzScore || 0;
  }

  /**
   * Calculate Sonneborn-Berger score
   * Another Swiss system tiebreaker
   */
  private calculateSonnebornBergerScore(
    participant: ITournamentParticipant,
  ): number {
    // This would calculate the sum of defeated opponents' points
    // plus half the points of drawn opponents
    return participant.metadata?.sonnebornBergerScore || 0;
  }

  /**
   * Generate balanced groups for group stage tournaments
   */
  generateGroups(
    participants: ITournamentParticipant[],
    groupCount: number,
  ): ITournamentParticipant[][] {
    const seeded = this.standardSeeding(participants);
    const groups: ITournamentParticipant[][] = Array(groupCount)
      .fill([])
      .map(() => []);

    // Distribute participants in snake draft style
    seeded.forEach((participant, index) => {
      const groupIndex = index % groupCount;
      groups[groupIndex].push(participant);
    });

    return groups;
  }

  /**
   * Pair participants for Swiss system round
   */
  pairForSwissRound(
    participants: ITournamentParticipant[],
    round: number,
  ): Array<[ITournamentParticipant, ITournamentParticipant]> {
    const sorted = this.swissSeeding(participants, round);
    const pairs: Array<[ITournamentParticipant, ITournamentParticipant]> = [];
    const used = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(sorted[i].id)) continue;

      // Find best opponent for this participant
      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(sorted[j].id)) continue;

        // Check if they've played before
        if (!this.havePlayedBefore(sorted[i], sorted[j])) {
          pairs.push([sorted[i], sorted[j]]);
          used.add(sorted[i].id);
          used.add(sorted[j].id);
          break;
        }
      }
    }

    return pairs;
  }

  /**
   * Check if two participants have played before
   */
  private havePlayedBefore(
    p1: ITournamentParticipant,
    p2: ITournamentParticipant,
  ): boolean {
    // This would check match history
    const p1Opponents = p1.metadata?.opponents || [];
    return p1Opponents.includes(p2.id);
  }
}
