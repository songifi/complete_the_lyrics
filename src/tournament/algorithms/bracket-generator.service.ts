import { Injectable } from '@nestjs/common';
import {
  IBracketGenerator,
  ITournamentParticipant,
  IBracketStructure,
  IMatchResult,
  IRound,
  IBracketMatch,
} from '../interfaces/tournament.interfaces';
import { TournamentFormat, MatchStatus } from '../enums/tournament.enums';

@Injectable()
export class BracketGeneratorService implements IBracketGenerator {
  generateBracket(
    participants: ITournamentParticipant[],
    format: TournamentFormat,
  ): IBracketStructure {
    switch (format) {
      case TournamentFormat.SINGLE_ELIMINATION:
        return this.generateSingleEliminationBracket(participants);
      case TournamentFormat.DOUBLE_ELIMINATION:
        return this.generateDoubleEliminationBracket(participants);
      case TournamentFormat.ROUND_ROBIN:
        return this.generateRoundRobinBracket(participants);
      case TournamentFormat.SWISS_SYSTEM:
        return this.generateSwissBracket(participants);
      default:
        throw new Error(`Unsupported tournament format: ${format}`);
    }
  }

  updateBracket(
    bracket: IBracketStructure,
    matchResult: IMatchResult,
  ): IBracketStructure {
    const updatedBracket = { ...bracket };

    // Find and update the match
    for (const round of updatedBracket.rounds) {
      const match = round.matches.find((m) => m.id === matchResult.matchId);
      if (match) {
        match.homeScore = matchResult.homeScore;
        match.awayScore = matchResult.awayScore;
        match.winnerId = matchResult.winnerId;
        match.status = MatchStatus.COMPLETED;

        // Advance winner to next round if applicable
        this.advanceWinner(updatedBracket, match);
        break;
      }
    }

    return updatedBracket;
  }

  private generateSingleEliminationBracket(
    participants: ITournamentParticipant[],
  ): IBracketStructure {
    const participantCount = participants.length;
    const rounds: IRound[] = [];

    // Calculate number of rounds needed
    const totalRounds = Math.ceil(Math.log2(participantCount));

    // Ensure we have a power of 2 participants (add byes if needed)
    const powerOf2 = Math.pow(2, totalRounds);
    const seededParticipants = this.seedParticipants(participants, powerOf2);

    // Generate first round
    const firstRound = this.generateFirstRound(seededParticipants);
    rounds.push(firstRound);

    // Generate subsequent rounds
    for (let roundNum = 2; roundNum <= totalRounds; roundNum++) {
      const round: IRound = {
        roundNumber: roundNum,
        matches: this.generateEmptyMatches(
          Math.pow(2, totalRounds - roundNum),
          roundNum,
        ),
        isCompleted: false,
      };
      rounds.push(round);
    }

    // Link matches between rounds
    this.linkSingleEliminationMatches(rounds);

    return {
      format: TournamentFormat.SINGLE_ELIMINATION,
      rounds,
      totalRounds,
      metadata: { participantCount, powerOf2 },
    };
  }

  private generateDoubleEliminationBracket(
    participants: ITournamentParticipant[],
  ): IBracketStructure {
    const participantCount = participants.length;
    const totalRounds = Math.ceil(Math.log2(participantCount)) * 2; // Approximate
    const powerOf2 = Math.pow(2, Math.ceil(Math.log2(participantCount)));
    const seededParticipants = this.seedParticipants(participants, powerOf2);

    const rounds: IRound[] = [];

    // Generate winners bracket (similar to single elimination)
    const winnersRounds = Math.ceil(Math.log2(participantCount));

    // First round of winners bracket
    const firstRound = this.generateFirstRound(seededParticipants, 'winners');
    rounds.push(firstRound);

    // Subsequent winners bracket rounds
    for (let roundNum = 2; roundNum <= winnersRounds; roundNum++) {
      const round: IRound = {
        roundNumber: roundNum,
        matches: this.generateEmptyMatches(
          Math.pow(2, winnersRounds - roundNum),
          roundNum,
          'winners',
        ),
        isCompleted: false,
      };
      rounds.push(round);
    }

    // Generate losers bracket
    this.generateLosersBracket(rounds, winnersRounds, participantCount);

    // Generate finals
    this.generateDoubleEliminationFinals(rounds);

    return {
      format: TournamentFormat.DOUBLE_ELIMINATION,
      rounds,
      totalRounds,
      metadata: { participantCount, powerOf2, winnersRounds },
    };
  }

  private generateRoundRobinBracket(
    participants: ITournamentParticipant[],
  ): IBracketStructure {
    const participantCount = participants.length;
    const totalRounds = participantCount - 1;
    const rounds: IRound[] = [];

    // Generate round-robin schedule
    for (let roundNum = 1; roundNum <= totalRounds; roundNum++) {
      const matches: IBracketMatch[] = [];

      for (let i = 0; i < participantCount / 2; i++) {
        const homeIndex = (roundNum - 1 + i) % participantCount;
        const awayIndex =
          (participantCount - 1 - i + roundNum - 1) % participantCount;

        if (homeIndex !== awayIndex) {
          matches.push({
            id: `r${roundNum}m${matches.length + 1}`,
            round: roundNum,
            matchNumber: matches.length + 1,
            homeParticipantId: participants[homeIndex].id,
            awayParticipantId: participants[awayIndex].id,
            status: MatchStatus.SCHEDULED,
          });
        }
      }

      rounds.push({
        roundNumber: roundNum,
        matches,
        isCompleted: false,
      });
    }

    return {
      format: TournamentFormat.ROUND_ROBIN,
      rounds,
      totalRounds,
      metadata: { participantCount },
    };
  }

  private generateSwissBracket(
    participants: ITournamentParticipant[],
  ): IBracketStructure {
    const participantCount = participants.length;
    const totalRounds = Math.ceil(Math.log2(participantCount));
    const rounds: IRound[] = [];

    // First round: pair participants by seed
    const seededParticipants = this.seedParticipants(
      participants,
      participantCount,
    );
    const firstRound = this.generateSwissFirstRound(seededParticipants);
    rounds.push(firstRound);

    // Subsequent rounds will be generated dynamically based on results
    for (let roundNum = 2; roundNum <= totalRounds; roundNum++) {
      rounds.push({
        roundNumber: roundNum,
        matches: [], // Will be populated when previous round completes
        isCompleted: false,
      });
    }

    return {
      format: TournamentFormat.SWISS_SYSTEM,
      rounds,
      totalRounds,
      metadata: { participantCount },
    };
  }

  private seedParticipants(
    participants: ITournamentParticipant[],
    targetCount: number,
  ): ITournamentParticipant[] {
    const seeded = [...participants].sort(
      (a, b) => (a.seed || 999) - (b.seed || 999),
    );

    // Add byes if needed
    while (seeded.length < targetCount) {
      seeded.push({
        id: `bye-${seeded.length}`,
        playerId: '',
        status: participants[0].status,
        points: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        seed: 999,
      });
    }

    return seeded;
  }

  private generateFirstRound(
    participants: ITournamentParticipant[],
    position = '',
  ): IRound {
    const matches: IBracketMatch[] = [];

    for (let i = 0; i < participants.length; i += 2) {
      const home = participants[i];
      const away = participants[i + 1];

      matches.push({
        id: `r1m${matches.length + 1}`,
        round: 1,
        matchNumber: matches.length + 1,
        homeParticipantId: home?.id,
        awayParticipantId: away?.id,
        status: MatchStatus.SCHEDULED,
        position,
      });
    }

    return {
      roundNumber: 1,
      matches,
      isCompleted: false,
    };
  }

  private generateEmptyMatches(
    count: number,
    round: number,
    position = '',
  ): IBracketMatch[] {
    const matches: IBracketMatch[] = [];

    for (let i = 0; i < count; i++) {
      matches.push({
        id: `r${round}m${i + 1}`,
        round,
        matchNumber: i + 1,
        status: MatchStatus.SCHEDULED,
        position,
      });
    }

    return matches;
  }

  private linkSingleEliminationMatches(rounds: IRound[]): void {
    for (let roundIndex = 0; roundIndex < rounds.length - 1; roundIndex++) {
      const currentRound = rounds[roundIndex];
      const nextRound = rounds[roundIndex + 1];

      currentRound.matches.forEach((match, matchIndex) => {
        const nextMatchIndex = Math.floor(matchIndex / 2);
        if (nextRound.matches[nextMatchIndex]) {
          match.nextMatchId = nextRound.matches[nextMatchIndex].id;
        }
      });

      nextRound.matches.forEach((match, matchIndex) => {
        const prevMatch1Index = matchIndex * 2;
        const prevMatch2Index = matchIndex * 2 + 1;

        if (currentRound.matches[prevMatch1Index]) {
          match.previousMatch1Id = currentRound.matches[prevMatch1Index].id;
        }
        if (currentRound.matches[prevMatch2Index]) {
          match.previousMatch2Id = currentRound.matches[prevMatch2Index].id;
        }
      });
    }
  }

  private generateLosersBracket(
    rounds: IRound[],
    winnersRounds: number,
    participantCount: number,
  ): void {
    // Complex losers bracket generation for double elimination
    // This is a simplified version - full implementation would be more complex
    const losersRounds = (winnersRounds - 1) * 2;

    for (let i = 0; i < losersRounds; i++) {
      const round: IRound = {
        roundNumber: winnersRounds + i + 1,
        matches: this.generateEmptyMatches(
          Math.max(1, Math.floor(participantCount / Math.pow(2, i + 2))),
          winnersRounds + i + 1,
          'losers',
        ),
        isCompleted: false,
      };
      rounds.push(round);
    }
  }

  private generateDoubleEliminationFinals(rounds: IRound[]): void {
    // Add finals matches
    const finalsRound: IRound = {
      roundNumber: rounds.length + 1,
      matches: [
        {
          id: `finals1`,
          round: rounds.length + 1,
          matchNumber: 1,
          status: MatchStatus.SCHEDULED,
          position: 'finals',
        },
      ],
      isCompleted: false,
    };

    rounds.push(finalsRound);

    // Potential second finals match if losers bracket winner beats winners bracket winner
    const finalFinalsRound: IRound = {
      roundNumber: rounds.length + 1,
      matches: [
        {
          id: `finals2`,
          round: rounds.length + 1,
          matchNumber: 1,
          status: MatchStatus.SCHEDULED,
          position: 'finals',
        },
      ],
      isCompleted: false,
    };

    rounds.push(finalFinalsRound);
  }

  private generateSwissFirstRound(
    participants: ITournamentParticipant[],
  ): IRound {
    const matches: IBracketMatch[] = [];
    const shuffled = [...participants];

    // Simple pairing for first round
    for (let i = 0; i < shuffled.length; i += 2) {
      if (i + 1 < shuffled.length) {
        matches.push({
          id: `r1m${matches.length + 1}`,
          round: 1,
          matchNumber: matches.length + 1,
          homeParticipantId: shuffled[i].id,
          awayParticipantId: shuffled[i + 1].id,
          status: MatchStatus.SCHEDULED,
        });
      }
    }

    return {
      roundNumber: 1,
      matches,
      isCompleted: false,
    };
  }

  private advanceWinner(
    bracket: IBracketStructure,
    completedMatch: IBracketMatch,
  ): void {
    if (!completedMatch.nextMatchId || !completedMatch.winnerId) {
      return;
    }

    // Find the next match and set the winner as a participant
    for (const round of bracket.rounds) {
      const nextMatch = round.matches.find(
        (m) => m.id === completedMatch.nextMatchId,
      );
      if (nextMatch) {
        if (!nextMatch.homeParticipantId) {
          nextMatch.homeParticipantId = completedMatch.winnerId;
        } else if (!nextMatch.awayParticipantId) {
          nextMatch.awayParticipantId = completedMatch.winnerId;
        }
        break;
      }
    }
  }
}
