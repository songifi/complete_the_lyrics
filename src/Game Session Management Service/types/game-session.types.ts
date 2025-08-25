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
