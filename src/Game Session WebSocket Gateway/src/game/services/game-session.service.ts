import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { GameSession } from "../entities/game-session.entity";
import { Player } from "../entities/player.entity";
import { ChatMessage } from "../entities/chat-message.entity";
import { CreateSessionDto } from "../dto/create-session.dto";
import { JoinSessionDto } from "../dto/join-session.dto";
import { ChatMessageDto, MessageType } from "../dto/chat-message.dto";
import { SessionStateUpdateDto } from "../dto/session-state.dto";
import { GameSessionStatus } from "../interfaces/session.interface";
import { PlayerRole } from "../interfaces/player.interface";

@Injectable()
export class GameSessionService {
  constructor(
    @InjectRepository(GameSession)
    private sessionRepository: Repository<GameSession>,
    @InjectRepository(Player)
    private playerRepository: Repository<Player>,
    @InjectRepository(ChatMessage)
    private chatRepository: Repository<ChatMessage>
  ) {}

  async createSession(
    createSessionDto: CreateSessionDto,
    hostPlayerId: string
  ): Promise<GameSession> {
    const session = this.sessionRepository.create({
      name: createSessionDto.name,
      maxPlayers: createSessionDto.maxPlayers,
      settings: {
        isPrivate: createSessionDto.isPrivate || false,
        allowSpectators: createSessionDto.allowSpectators !== false,
        maxChatHistory: createSessionDto.maxChatHistory || 100,
      },
      gameData: {},
    });

    const savedSession = await this.sessionRepository.save(session);

    // Add host player
    await this.addPlayerToSession(
      savedSession.id,
      {
        sessionId: savedSession.id,
        username: `Host_${hostPlayerId}`,
        role: PlayerRole.HOST,
      },
      hostPlayerId
    );

    return this.getSessionById(savedSession.id);
  }

  async joinSession(
    joinSessionDto: JoinSessionDto,
    playerId: string
  ): Promise<{ session: GameSession; player: Player }> {
    const session = await this.getSessionById(joinSessionDto.sessionId);

    if (session.currentPlayers >= session.maxPlayers) {
      throw new BadRequestException("Session is full");
    }

    if (session.status === GameSessionStatus.FINISHED) {
      throw new BadRequestException("Session has ended");
    }

    const player = await this.addPlayerToSession(
      session.id,
      joinSessionDto,
      playerId
    );

    return {
      session: await this.getSessionById(session.id),
      player,
    };
  }

  async leaveSession(sessionId: string, playerId: string): Promise<void> {
    const session = await this.getSessionById(sessionId);
    const player = await this.getPlayerInSession(sessionId, playerId);

    await this.playerRepository.remove(player);
    await this.sessionRepository.update(sessionId, {
      currentPlayers: session.currentPlayers - 1,
    });

    // If host leaves and there are other players, assign new host
    if (player.role === PlayerRole.HOST) {
      await this.reassignHost(sessionId);
    }

    // End session if no players left
    if (session.currentPlayers <= 1) {
      await this.endSession(sessionId);
    }
  }

  async sendChatMessage(
    sessionId: string,
    playerId: string,
    chatMessageDto: ChatMessageDto
  ): Promise<ChatMessage> {
    const session = await this.getSessionById(sessionId);
    const player = await this.getPlayerInSession(sessionId, playerId);

    const chatMessage = this.chatRepository.create({
      content: chatMessageDto.content,
      type: chatMessageDto.type || MessageType.CHAT,
      targetPlayerId: chatMessageDto.targetPlayerId,
      session,
      sender: player,
    });

    const savedMessage = await this.chatRepository.save(chatMessage);

    // Clean up old messages if exceeding limit
    await this.cleanupChatHistory(sessionId, session.settings.maxChatHistory);

    return this.chatRepository.findOne({
      where: { id: savedMessage.id },
      relations: ["sender", "session"],
    });
  }

  async updateSessionState(
    sessionStateDto: SessionStateUpdateDto
  ): Promise<GameSession> {
    const session = await this.getSessionById(sessionStateDto.sessionId);

    const updateData: Partial<GameSession> = {
      updatedAt: new Date(),
    };

    if (sessionStateDto.gameData) {
      updateData.gameData = {
        ...session.gameData,
        ...sessionStateDto.gameData,
      };
    }

    await this.sessionRepository.update(sessionStateDto.sessionId, updateData);
    return this.getSessionById(sessionStateDto.sessionId);
  }

  async getSessionById(sessionId: string): Promise<GameSession> {
    const session = await this.sessionRepository.findOne({
      where: { id: sessionId },
      relations: ["players", "chatMessages"],
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    return session;
  }

  async getPlayerInSession(
    sessionId: string,
    playerId: string
  ): Promise<Player> {
    const player = await this.playerRepository.findOne({
      where: { id: playerId, session: { id: sessionId } },
      relations: ["session"],
    });

    if (!player) {
      throw new NotFoundException("Player not found in session");
    }

    return player;
  }

  async getActiveSessions(): Promise<GameSession[]> {
    return this.sessionRepository.find({
      where: {
        status: GameSessionStatus.ACTIVE,
      },
      relations: ["players"],
    });
  }

  async getChatHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<ChatMessage[]> {
    return this.chatRepository.find({
      where: { session: { id: sessionId } },
      relations: ["sender"],
      order: { createdAt: "DESC" },
      take: limit,
    });
  }

  private async addPlayerToSession(
    sessionId: string,
    joinData: JoinSessionDto,
    playerId: string
  ): Promise<Player> {
    const player = this.playerRepository.create({
      id: playerId,
      username: joinData.username,
      role: joinData.role || PlayerRole.PLAYER,
      metadata: {},
      session: { id: sessionId } as GameSession,
    });

    const savedPlayer = await this.playerRepository.save(player);

    // Update session player count
    await this.sessionRepository.increment(
      { id: sessionId },
      "currentPlayers",
      1
    );

    return savedPlayer;
  }

  private async reassignHost(sessionId: string): Promise<void> {
    const players = await this.playerRepository.find({
      where: { session: { id: sessionId } },
      order: { createdAt: "ASC" },
    });

    if (players.length > 0) {
      await this.playerRepository.update(players[0].id, {
        role: PlayerRole.HOST,
      });
    }
  }

  private async endSession(sessionId: string): Promise<void> {
    await this.sessionRepository.update(sessionId, {
      status: GameSessionStatus.FINISHED,
    });
  }

  private async cleanupChatHistory(
    sessionId: string,
    maxMessages: number
  ): Promise<void> {
    const totalMessages = await this.chatRepository.count({
      where: { session: { id: sessionId } },
    });

    if (totalMessages > maxMessages) {
      const excessCount = totalMessages - maxMessages;
      const oldMessages = await this.chatRepository.find({
        where: { session: { id: sessionId } },
        order: { createdAt: "ASC" },
        take: excessCount,
      });

      await this.chatRepository.remove(oldMessages);
    }
  }
}
