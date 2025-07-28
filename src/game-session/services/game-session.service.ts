import { Injectable, Inject, LoggerService } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSession, GameSessionStatus } from '../entities/game-session.entity';
import { CreateSessionDto } from '../dto/create-session.dto';
import { JoinSessionDto } from '../dto/join-session.dto';
import { SessionNotFoundException } from '../exceptions/session-not-found.exception';
import { SessionFullException } from '../exceptions/session-full.exception';
import { RedisService } from 'nestjs-redis';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class GameSessionService {
  constructor(
    @InjectRepository(GameSession)
    private readonly sessionRepo: Repository<GameSession>,
    private readonly redisService: RedisService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {}

  async createSession(dto: CreateSessionDto): Promise<GameSession> {
    const session = this.sessionRepo.create({ ...dto, status: GameSessionStatus.WAITING });
    await this.sessionRepo.save(session);
    await this.redisService.getClient().set(`session:${session.id}`, JSON.stringify(session));
    this.logger.log('Session created', { sessionId: session.id });
    return session;
  }

  async joinSession(dto: JoinSessionDto): Promise<GameSession> {
    const session = await this.sessionRepo.findOne({ where: { id: dto.sessionId } });
    if (!session) throw new SessionNotFoundException(dto.sessionId);
    if (session.playerIds.length >= session.maxPlayers) throw new SessionFullException(dto.sessionId);
    session.playerIds.push(dto.playerId);
    await this.sessionRepo.save(session);
    await this.redisService.getClient().set(`session:${session.id}`, JSON.stringify(session));
    this.logger.log('Player joined session', { sessionId: session.id, playerId: dto.playerId });
    return session;
  }

  async recordPlayerAction(data: any): Promise<GameSession> {
    const session = await this.sessionRepo.findOne({ where: { id: data.sessionId } });
    if (!session) throw new SessionNotFoundException(data.sessionId);
    session.playerActions = { ...(session.playerActions || {}), [data.playerId]: data.action };
    await this.sessionRepo.save(session);
    await this.redisService.getClient().set(`session:${session.id}`, JSON.stringify(session));
    this.logger.log('Player action recorded', { sessionId: session.id, playerId: data.playerId, action: data.action });
    return session;
  }

  async endSession(sessionId: string): Promise<GameSession> {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new SessionNotFoundException(sessionId);
    session.status = GameSessionStatus.COMPLETED;
    session.endedAt = new Date();
    session.duration = (session.endedAt.getTime() - (session.startedAt?.getTime() || session.createdAt.getTime())) / 1000;
    await this.sessionRepo.save(session);
    await this.redisService.getClient().del(`session:${session.id}`);
    this.logger.log('Session ended', { sessionId: session.id });
    return session;
  }

  async findById(sessionId: string): Promise<GameSession | undefined> {
    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }
}
