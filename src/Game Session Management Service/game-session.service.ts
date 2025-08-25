import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EventEmitter2 } from "@nestjs/event-emitter";
import {
  GameSession,
  Player,
  SessionState,
  SessionConfiguration,
  CreateSessionDto,
  JoinSessionDto,
  SessionAnalytics,
} from "./types/game-session.types";

@Injectable()
export class GameSessionService {
  private readonly logger = new Logger(GameSessionService.name);
  private readonly sessions = new Map<string, GameSession>();
  private readonly sessionsByCode = new Map<string, string>();
  private readonly playerSessions = new Map<string, string>();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  // Session Creation
  async createSession(dto: CreateSessionDto): Promise<GameSession> {
    const sessionId = this.generateSessionId();
    const sessionCode = this.generateSessionCode();

    // Ensure unique code
    if (this.sessionsByCode.has(sessionCode)) {
      return this.createSession(dto); // Retry with new code
    }

    const defaultConfig: SessionConfiguration = {
      maxPlayers: 8,
      timeout: 30,
      allowSpectators: true,
      isPrivate: false,
      gameType: "default",
      customSettings: {},
      ...dto.configuration,
    };

    const host: Player = {
      id: dto.hostId,
      name: dto.hostName,
      joinedAt: new Date(),
      isHost: true,
      isActive: true,
      lastActivity: new Date(),
    };

    const session: GameSession = {
      id: sessionId,
      code: sessionCode,
      hostId: dto.hostId,
      players: new Map([[dto.hostId, host]]),
      spectators: new Map(),
      state: SessionState.WAITING,
      configuration: defaultConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + defaultConfig.timeout * 60 * 1000),
      analytics: this.initializeAnalytics(),
    };

    this.sessions.set(sessionId, session);
    this.sessionsByCode.set(sessionCode, sessionId);
    this.playerSessions.set(dto.hostId, sessionId);

    this.logger.log(`Session created: ${sessionCode} (${sessionId})`);

    this.eventEmitter.emit("session.created", session);
    this.trackStateTransition(session, null, SessionState.WAITING);

    return session;
  }

  // Player Joining Logic
  async joinSession(dto: JoinSessionDto): Promise<GameSession> {
    const sessionId = this.sessionsByCode.get(dto.code);
    if (!sessionId) {
      throw new NotFoundException(`Session with code ${dto.code} not found`);
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    // Check if session is joinable
    if (
      session.state !== SessionState.WAITING &&
      session.state !== SessionState.ACTIVE
    ) {
      throw new BadRequestException("Session is not accepting new players");
    }

    // Check if player is already in session
    if (session.players.has(dto.playerId)) {
      throw new ConflictException("Player is already in this session");
    }

    // Check if another session has this player
    const existingSessionId = this.playerSessions.get(dto.playerId);
    if (existingSessionId && existingSessionId !== sessionId) {
      await this.leaveSession(dto.playerId);
    }

    const player: Player = {
      id: dto.playerId,
      name: dto.playerName,
      joinedAt: new Date(),
      isHost: false,
      isActive: true,
      lastActivity: new Date(),
    };

    if (dto.asSpectator && session.configuration.allowSpectators) {
      session.spectators.set(dto.playerId, player);
    } else {
      // Check player limit
      if (session.players.size >= session.configuration.maxPlayers) {
        if (session.configuration.allowSpectators) {
          session.spectators.set(dto.playerId, player);
        } else {
          throw new BadRequestException("Session is full");
        }
      } else {
        session.players.set(dto.playerId, player);
      }
    }

    this.playerSessions.set(dto.playerId, sessionId);
    session.updatedAt = new Date();

    // Update analytics
    session.analytics.totalPlayersJoined++;
    const currentPlayerCount = session.players.size + session.spectators.size;
    session.analytics.peakPlayerCount = Math.max(
      session.analytics.peakPlayerCount,
      currentPlayerCount
    );

    this.logger.log(`Player ${dto.playerName} joined session ${dto.code}`);

    this.eventEmitter.emit("session.player.joined", { session, player });

    return session;
  }

  // Player Leaving Logic
  async leaveSession(playerId: string): Promise<void> {
    const sessionId = this.playerSessions.get(playerId);
    if (!sessionId) {
      return; // Player not in any session
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      this.playerSessions.delete(playerId);
      return;
    }

    const isPlayer = session.players.has(playerId);
    const isSpectator = session.spectators.has(playerId);
    const wasHost = session.hostId === playerId;

    if (isPlayer) {
      session.players.delete(playerId);
    } else if (isSpectator) {
      session.spectators.delete(playerId);
    }

    this.playerSessions.delete(playerId);
    session.updatedAt = new Date();

    this.logger.log(`Player ${playerId} left session ${session.code}`);

    // Handle host leaving
    if (wasHost && session.players.size > 0) {
      await this.transferHost(session);
    }

    // Check if session should be cleaned up
    if (session.players.size === 0) {
      await this.cleanupSession(sessionId);
    } else {
      this.eventEmitter.emit("session.player.left", { session, playerId });
    }
  }

  // Session Configuration Management
  async updateConfiguration(
    sessionId: string,
    hostId: string,
    configuration: Partial<SessionConfiguration>
  ): Promise<GameSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    if (session.hostId !== hostId) {
      throw new BadRequestException(
        "Only the host can update session configuration"
      );
    }

    if (session.state !== SessionState.WAITING) {
      throw new BadRequestException(
        "Cannot update configuration after session has started"
      );
    }

    session.configuration = { ...session.configuration, ...configuration };
    session.updatedAt = new Date();

    this.logger.log(`Configuration updated for session ${session.code}`);
    this.eventEmitter.emit("session.config.updated", session);

    return session;
  }

  // Session State Transitions
  async transitionState(
    sessionId: string,
    newState: SessionState
  ): Promise<GameSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    const oldState = session.state;

    if (!this.isValidStateTransition(oldState, newState)) {
      throw new BadRequestException(
        `Invalid state transition from ${oldState} to ${newState}`
      );
    }

    session.state = newState;
    session.updatedAt = new Date();

    // Update expiration based on new state
    if (newState === SessionState.ACTIVE) {
      session.expiresAt = new Date(
        Date.now() + session.configuration.timeout * 60 * 1000
      );
    }

    this.trackStateTransition(session, oldState, newState);

    this.logger.log(
      `Session ${session.code} transitioned from ${oldState} to ${newState}`
    );
    this.eventEmitter.emit("session.state.changed", {
      session,
      oldState,
      newState,
    });

    return session;
  }

  // Session Retrieval
  async getSession(sessionId: string): Promise<GameSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }
    return session;
  }

  async getSessionByCode(code: string): Promise<GameSession> {
    const sessionId = this.sessionsByCode.get(code);
    if (!sessionId) {
      throw new NotFoundException(`Session with code ${code} not found`);
    }
    return this.getSession(sessionId);
  }

  async getPlayerSession(playerId: string): Promise<GameSession | null> {
    const sessionId = this.playerSessions.get(playerId);
    if (!sessionId) {
      return null;
    }

    try {
      return await this.getSession(sessionId);
    } catch {
      this.playerSessions.delete(playerId);
      return null;
    }
  }

  // Player Activity Management
  async updatePlayerActivity(playerId: string): Promise<void> {
    const sessionId = this.playerSessions.get(playerId);
    if (!sessionId) {
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    const player =
      session.players.get(playerId) || session.spectators.get(playerId);
    if (player) {
      player.lastActivity = new Date();
      player.isActive = true;
    }
  }

  // Session Cleanup
  @Cron(CronExpression.EVERY_MINUTE)
  async performRoutineCleanup(): Promise<void> {
    const now = new Date();
    const sessionsToCleanup: string[] = [];

    for (const [sessionId, session] of this.sessions) {
      // Check for expired sessions
      if (now > session.expiresAt) {
        sessionsToCleanup.push(sessionId);
        continue;
      }

      // Check for inactive players
      await this.handleInactivePlayers(session);

      // Check for empty sessions
      if (session.players.size === 0) {
        sessionsToCleanup.push(sessionId);
      }
    }

    for (const sessionId of sessionsToCleanup) {
      await this.cleanupSession(sessionId);
    }

    if (sessionsToCleanup.length > 0) {
      this.logger.log(`Cleaned up ${sessionsToCleanup.length} sessions`);
    }
  }

  private async cleanupSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    // Remove all player mappings
    for (const playerId of session.players.keys()) {
      this.playerSessions.delete(playerId);
    }
    for (const spectatorId of session.spectators.keys()) {
      this.playerSessions.delete(spectatorId);
    }

    // Remove session mappings
    this.sessions.delete(sessionId);
    this.sessionsByCode.delete(session.code);

    this.logger.log(`Session cleaned up: ${session.code} (${sessionId})`);
    this.eventEmitter.emit("session.cleaned.up", session);
  }

  // Analytics
  getSessionAnalytics(sessionId: string): SessionAnalytics {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new NotFoundException("Session not found");
    }

    // Update duration if session is still active
    if (
      session.state !== SessionState.FINISHED &&
      session.state !== SessionState.EXPIRED
    ) {
      const duration = Date.now() - session.createdAt.getTime();
      session.analytics.averageSessionDuration = duration;
    }

    return session.analytics;
  }

  getGlobalAnalytics() {
    const totalSessions = this.sessions.size;
    const activeSessions = Array.from(this.sessions.values()).filter(
      (s) => s.state === SessionState.ACTIVE || s.state === SessionState.WAITING
    ).length;

    const totalPlayers = Array.from(this.sessions.values()).reduce(
      (sum, session) => sum + session.players.size + session.spectators.size,
      0
    );

    return {
      totalSessions,
      activeSessions,
      totalPlayers,
      averagePlayersPerSession:
        totalSessions > 0 ? totalPlayers / totalSessions : 0,
    };
  }

  // Private Helper Methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSessionCode(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private initializeAnalytics(): SessionAnalytics {
    return {
      totalPlayersJoined: 1, // Host counts as first player
      peakPlayerCount: 1,
      averageSessionDuration: 0,
      playerTurnover: 0,
      stateTransitions: [],
    };
  }

  private trackStateTransition(
    session: GameSession,
    from: SessionState | null,
    to: SessionState
  ): void {
    session.analytics.stateTransitions.push({
      from: from as SessionState,
      to,
      timestamp: new Date(),
    });
  }

  private isValidStateTransition(
    from: SessionState,
    to: SessionState
  ): boolean {
    const validTransitions: Record<SessionState, SessionState[]> = {
      [SessionState.WAITING]: [SessionState.ACTIVE, SessionState.EXPIRED],
      [SessionState.ACTIVE]: [
        SessionState.PAUSED,
        SessionState.FINISHED,
        SessionState.EXPIRED,
      ],
      [SessionState.PAUSED]: [
        SessionState.ACTIVE,
        SessionState.FINISHED,
        SessionState.EXPIRED,
      ],
      [SessionState.FINISHED]: [SessionState.EXPIRED],
      [SessionState.EXPIRED]: [],
    };

    return validTransitions[from]?.includes(to) || false;
  }

  private async transferHost(session: GameSession): Promise<void> {
    const players = Array.from(session.players.values());
    if (players.length === 0) {
      return;
    }

    // Transfer to the longest-standing player
    const newHost = players.reduce((oldest, current) =>
      current.joinedAt < oldest.joinedAt ? current : oldest
    );

    const oldHostId = session.hostId;
    session.hostId = newHost.id;
    newHost.isHost = true;

    this.logger.log(
      `Host transferred from ${oldHostId} to ${newHost.id} in session ${session.code}`
    );
    this.eventEmitter.emit("session.host.transferred", {
      session,
      oldHostId,
      newHostId: newHost.id,
    });
  }

  private async handleInactivePlayers(session: GameSession): Promise<void> {
    const inactivityThreshold = 5 * 60 * 1000; // 5 minutes
    const now = new Date();
    const playersToRemove: string[] = [];

    for (const [playerId, player] of session.players) {
      if (now.getTime() - player.lastActivity.getTime() > inactivityThreshold) {
        player.isActive = false;
        if (!player.isHost) {
          playersToRemove.push(playerId);
        }
      }
    }

    for (const playerId of playersToRemove) {
      await this.leaveSession(playerId);
    }
  }
}
