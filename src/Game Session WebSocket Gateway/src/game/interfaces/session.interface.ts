export interface IGameSession {
  id: string;
  name: string;
  maxPlayers: number;
  currentPlayers: number;
  status: GameSessionStatus;
  createdAt: Date;
  updatedAt: Date;
  settings: GameSettings;
}

export interface GameSettings {
  isPrivate: boolean;
  allowSpectators: boolean;
  maxChatHistory: number;
}

export enum GameSessionStatus {
  WAITING = "waiting",
  ACTIVE = "active",
  PAUSED = "paused",
  FINISHED = "finished",
}

export interface SessionState {
  sessionId: string;
  players: IPlayer[];
  gameData: Record<string, any>;
  status: GameSessionStatus;
  lastUpdated: Date;
}
