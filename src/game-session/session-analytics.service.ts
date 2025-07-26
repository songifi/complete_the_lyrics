import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameSession } from './entities/game-session.entity';

@Injectable()
export class SessionAnalyticsService {
  constructor(
    @InjectRepository(GameSession)
    private readonly sessionRepo: Repository<GameSession>,
  ) {}

  async getSessionAnalytics(sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) return null;
    return {
      sessionId: session.id,
      duration: session.duration,
      playerIds: session.playerIds,
      completionRate: session.completionRate,
      playerActions: session.playerActions,
    };
  }
}
