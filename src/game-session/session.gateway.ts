import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from 'winston';
import { GameSessionService } from './services/game-session.service';

@WebSocketGateway({ namespace: '/game-session' })
export class GameSessionGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly sessionService: GameSessionService, private readonly logger: Logger) {}

  @SubscribeMessage('createSession')
  async handleCreateSession(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const session = await this.sessionService.createSession(data);
    this.logger.info('Session created', { sessionId: session.id });
    client.join(session.id);
    this.server.to(session.id).emit('sessionUpdate', session);
    return session;
  }

  @SubscribeMessage('joinSession')
  async handleJoinSession(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const session = await this.sessionService.joinSession(data);
    this.logger.info('Player joined session', { sessionId: session.id, playerId: data.playerId });
    client.join(session.id);
    this.server.to(session.id).emit('sessionUpdate', session);
    return session;
  }

  @SubscribeMessage('playerAction')
  async handlePlayerAction(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const session = await this.sessionService.recordPlayerAction(data);
    this.server.to(session.id).emit('playerAction', data);
    return session;
  }

  @SubscribeMessage('endSession')
  async handleEndSession(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    const session = await this.sessionService.endSession(data.sessionId);
    this.logger.info('Session ended', { sessionId: session.id });
    this.server.to(session.id).emit('sessionUpdate', session);
    return session;
  }
}
