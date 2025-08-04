import {
  TournamentFormat,
  ParticipantStatus,
  MatchStatus,
} from '../enums/tournament.enums';

export interface IBracketGenerator {
  generateBracket(
    participants: ITournamentParticipant[],
    format: TournamentFormat,
  ): IBracketStructure;
  updateBracket(
    bracket: IBracketStructure,
    matchResult: IMatchResult,
  ): IBracketStructure;
}

export interface ITournamentParticipant {
  id: string;
  playerId: string;
  teamId?: string;
  seed?: number;
  status: ParticipantStatus;
  points: number;
  wins: number;
  losses: number;
  draws: number;
  metadata?: Record<string, any>;
}

export interface IBracketStructure {
  format: TournamentFormat;
  rounds: IRound[];
  totalRounds: number;
  metadata?: Record<string, any>;
}

export interface IRound {
  roundNumber: number;
  matches: IBracketMatch[];
  isCompleted: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface IBracketMatch {
  id: string;
  round: number;
  matchNumber: number;
  homeParticipantId?: string;
  awayParticipantId?: string;
  winnerId?: string;
  homeScore?: number;
  awayScore?: number;
  status: MatchStatus;
  nextMatchId?: string;
  previousMatch1Id?: string;
  previousMatch2Id?: string;
  position?: string; // For double elimination (winners/losers bracket)
}

export interface IMatchResult {
  matchId: string;
  homeParticipantId?: string;
  awayParticipantId?: string;
  homeScore: number;
  awayScore: number;
  winnerId?: string;
  isDraw?: boolean;
  metadata?: Record<string, any>;
}

export interface ISeedingStrategy {
  generateSeeds(
    participants: ITournamentParticipant[],
  ): ITournamentParticipant[];
}

export interface ITournamentEligibilityCheck {
  isEligible(playerId: string, tournamentId: string): Promise<boolean>;
  getEligibilityReason(playerId: string, tournamentId: string): Promise<string>;
}

export interface ITournamentNotification {
  type: string;
  tournamentId: string;
  recipientId?: string;
  data: Record<string, any>;
  createdAt: Date;
}

export interface IPrizeCalculator {
  calculatePrizes(
    tournament: ITournament,
    participants: ITournamentParticipant[],
  ): IPrizeDistribution[];
}

export interface IPrizeDistribution {
  rank: number;
  prizeAmount: number;
  prizeType: string;
  prizeData?: Record<string, any>;
  winnerId?: string;
}

export interface ITournament {
  id: string;
  name: string;
  format: TournamentFormat;
  maxParticipants?: number;
  minParticipants: number;
  prizePool?: number;
  settings?: Record<string, any>;
  participants: ITournamentParticipant[];
}

export interface ITournamentSettings {
  allowBye: boolean;
  randomizeSeeds: boolean;
  autoAdvance: boolean;
  matchDuration?: number;
  breakDuration?: number;
  tiebreakRules?: Record<string, any>;
}

export interface IMatchScheduler {
  scheduleMatch(match: IBracketMatch, tournament: ITournament): Date;
  rescheduleMatch(matchId: string, newDate: Date): Promise<boolean>;
  getAvailableTimeSlots(tournamentId: string, date: Date): Date[];
}

export interface ITournamentState {
  tournamentId: string;
  currentRound: number;
  activeMatches: string[];
  completedMatches: string[];
  bracket: IBracketStructure;
  lastUpdated: Date;
}

export interface ISeededParticipant extends ITournamentParticipant {
  seed: number;
  ranking?: number;
  skillRating?: number;
}
