export interface IPlayer {
  id: string;
  username: string;
  socketId?: string;
  isOnline: boolean;
  lastSeen: Date;
  role: PlayerRole;
  sessionId?: string;
  metadata: PlayerMetadata;
}

export interface PlayerMetadata {
  avatar?: string;
  level?: number;
  score?: number;
  customData?: Record<string, any>;
}

export enum PlayerRole {
  HOST = "host",
  PLAYER = "player",
  SPECTATOR = "spectator",
}

export interface PlayerPresence {
  playerId: string;
  isOnline: boolean;
  lastSeen: Date;
  socketIds: string[];
}
