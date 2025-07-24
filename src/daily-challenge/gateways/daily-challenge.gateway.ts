import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ namespace: '/daily-challenge' })
export class DailyChallengeGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DailyChallengeGateway.name);

  @SubscribeMessage('progressUpdate')
  handleProgressUpdate(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    // Broadcast progress update to all clients (or a room)
    this.logger.log(`Progress update from user ${data.userId}`);
    this.server.emit('progressUpdate', data);
  }

  @SubscribeMessage('shareChallenge')
  handleShareChallenge(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    // Broadcast challenge sharing event
    this.logger.log(`Challenge shared by user ${data.userId}`);
    this.server.emit('challengeShared', data);
  }
} 