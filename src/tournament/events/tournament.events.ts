export class TournamentCreatedEvent {
  constructor(
    public readonly tournamentId: string,
    public readonly tournament: any,
    public readonly createdBy: string,
  ) {}
}

export class TournamentStartedEvent {
  constructor(
    public readonly tournamentId: string,
    public readonly tournament: any,
    public readonly startedAt: Date,
  ) {}
}

export class TournamentCompletedEvent {
  constructor(
    public readonly tournamentId: string,
    public readonly tournament: any,
    public readonly winner: any,
    public readonly completedAt: Date,
  ) {}
}

export class ParticipantRegisteredEvent {
  constructor(
    public readonly tournamentId: string,
    public readonly participant: any,
    public readonly tournament: any,
  ) {}
}

export class ParticipantEliminatedEvent {
  constructor(
    public readonly tournamentId: string,
    public readonly participant: any,
    public readonly round: number,
    public readonly eliminatedAt: Date,
  ) {}
}

export class MatchStartedEvent {
  constructor(
    public readonly matchId: string,
    public readonly tournamentId: string,
    public readonly participants: string[],
    public readonly startedAt: Date,
  ) {}
}

export class MatchCompletedEvent {
  constructor(
    public readonly matchId: string,
    public readonly tournamentId: string,
    public readonly match: any,
    public readonly result: any,
    public readonly completedAt: Date,
  ) {}
}

export class MatchScheduledEvent {
  constructor(
    public readonly matchId: string,
    public readonly tournamentId: string,
    public readonly scheduledAt: Date,
  ) {}
}

export class RoundCompletedEvent {
  constructor(
    public readonly tournamentId: string,
    public readonly round: number,
    public readonly completedAt: Date,
  ) {}
}

export class LeaderboardUpdatedEvent {
  constructor(
    public readonly tournamentId: string,
    public readonly leaderboard: any[],
    public readonly updatedAt: Date,
  ) {}
}

export class PrizeDistributedEvent {
  constructor(
    public readonly tournamentId: string,
    public readonly participant: any,
    public readonly prize: any,
    public readonly distributedAt: Date,
  ) {}
}
