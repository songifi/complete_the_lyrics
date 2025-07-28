import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GameSessionService } from './services/game-session.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { SessionAccessGuard } from './guards/session-access.guard';

@Controller('game-session')
export class GameSessionController {
  constructor(private readonly sessionService: GameSessionService) {}

  @Post('create')
  async createSession(@Body() dto: CreateSessionDto) {
    return this.sessionService.createSession(dto);
  }

  @Post('join')
  async joinSession(@Body() dto: JoinSessionDto) {
    return this.sessionService.joinSession(dto);
  }

  @Post('action')
  @UseGuards(SessionAccessGuard)
  async playerAction(@Body() data: any) {
    return this.sessionService.recordPlayerAction(data);
  }

  @Post('end/:sessionId')
  async endSession(@Param('sessionId') sessionId: string) {
    return this.sessionService.endSession(sessionId);
  }
}
