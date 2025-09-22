export interface Player {
  id: string;
  name: string;
  joinedAt: Date;
  isHost: boolean;
  isActive: boolean;
  lastActivity: Date;
}

export interface SessionConfiguration {
  maxPlayers: number;
  timeout: number; // in minutes
  allowSpectators: boolean;
  isPrivate: boolean;
  gameType: string;
  customSettings: Record<string, any>;
}

export enum SessionState {
  WAITING = "waiting",
  ACTIVE = "active",
  PAUSED = "paused",
  FINISHED = "finished",
  EXPIRED = "expired",
}

export interface GameSession {
  id: string;
  code: string;
  hostId: string;
  players: Map<string, Player>;
  spectators: Map<string, Player>;
  state: SessionState;
  configuration: SessionConfiguration;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  analytics: SessionAnalytics;
  bannedPlayerIds?: Set<string>;
}

export interface SessionAnalytics {
  totalPlayersJoined: number;
  peakPlayerCount: number;
  averageSessionDuration: number;
  playerTurnover: number;
  stateTransitions: Array<{
    from: SessionState;
    to: SessionState;
    timestamp: Date;
  }>;
}

export interface CreateSessionDto {
  hostId: string;
  hostName: string;
  configuration: Partial<SessionConfiguration>;
}

export interface JoinSessionDto {
  code: string;
  playerId: string;
  playerName: string;
  asSpectator?: boolean;
}

export interface ListSessionsQuery {
  state?: SessionState | "waiting" | "active" | "paused" | "finished" | "expired";
  gameType?: string;
  isPrivate?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface SessionStatus {
  id: string;
  code: string;
  state: SessionState;
  playerCount: number;
  spectatorCount: number;
  maxPlayers: number;
  isPrivate: boolean;
  updatedAt: Date;
}

export interface SessionSummary {
  id: string;
  code: string;
  state: SessionState;
  gameType: string;
  isPrivate: boolean;
  createdAt: Date;
  updatedAt: Date;
  playerCount: number;
  spectatorCount: number;
}

export interface ModerationActionDto {
  hostId: string;
  targetId: string;
}

export interface TransferHostDto {
  hostId: string;
  newHostId: string;
}

export interface SessionArchiveEntry {
  id: string;
  code: string;
  hostId: string;
  gameType: string;
  isPrivate: boolean;
  startedAt: Date;
  endedAt: Date;
  finalState: SessionState;
  totalPlayers: number;
  participantIds: string[];
}
