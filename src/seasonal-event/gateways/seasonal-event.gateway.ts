import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ namespace: '/seasonal-event' })
export class SeasonalEventGateway {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SeasonalEventGateway.name);

  @SubscribeMessage('eventStatus')
  handleEventStatus(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(`Event status update: ${JSON.stringify(data)}`);
    this.server.emit('eventStatus', data);
  }

  @SubscribeMessage('participationUpdate')
  handleParticipationUpdate(@MessageBody() data: any, @ConnectedSocket() client: Socket) {
    this.logger.log(`Participation update: ${JSON.stringify(data)}`);
    this.server.emit('participationUpdate', data);
  }
} 