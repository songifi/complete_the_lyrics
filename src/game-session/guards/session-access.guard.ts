import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GameSessionService } from '../services/game-session.service';

@Injectable()
export class SessionAccessGuard implements CanActivate {
  constructor(private readonly sessionService: GameSessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const sessionId = req.params['sessionId'] || req.body.sessionId;
    const playerId = req.user?.id || req.body.playerId;
    if (!sessionId || !playerId) throw new ForbiddenException('Missing session or player ID');
    const session = await this.sessionService.findById(sessionId);
    if (!session) throw new ForbiddenException('Session not found');
    if (!session.playerIds.includes(playerId)) throw new ForbiddenException('Player not in session');
    return true;
  }
}
