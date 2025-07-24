// src/chat/gateways/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { RedisService } from 'nestjs-redis';

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer() server: Server;

  constructor(private readonly redisService: RedisService) {}

  afterInit(server: Server) {
    console.log('WebSocket server initialized');
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(client: Socket, roomId: string) {
    await client.join(roomId);
    const redisClient = this.redisService.getClient();
    await redisClient.sadd(`room:${roomId}:users`, client.data.user.id);
    client.emit('joinedRoom', roomId);
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(client: Socket, roomId: string) {
    await client.leave(roomId);
    const redisClient = this.redisService.getClient();
    await redisClient.srem(`room:${roomId}:users`, client.data.user.id);
    client.emit('leftRoom', roomId);
  }
}
