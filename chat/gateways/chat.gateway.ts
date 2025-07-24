// src/chat/gateways/chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards, Logger, UsePipes, UseFilters } from '@nestjs/common';
import { WsJwtGuard } from '../guards/ws-jwt.guard';
import { RedisService } from '../../common/database/redis.service';
import { ChatService } from '../services/chat.service';
import { SendMessageDto } from '../dtos/send-message.dto';
import { MessageValidationPipe } from '../pipes/message-validation.pipe';
import { ProfanityFilterPipe } from '../pipes/profanity-filter.pipe';
import { WsExceptionFilter } from '../filters/ws-exception.filter';
import { SocketUser } from '../interfaces/socket-user.interface';

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})
@UseFilters(new WsExceptionFilter())
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('ChatGateway');

  constructor(
    private readonly redisService: RedisService,
    private readonly chatService: ChatService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket server initialized');
  }

  async handleConnection(client: Socket) {
    const user = client.data.user as SocketUser;
    this.logger.log(`Client connected: ${user.userId}`);
    await this.redisService.addUserToOnlineList(user.userId);
    this.server.emit('userOnline', { userId: user.userId });
  }

  async handleDisconnect(client: Socket) {
    const user = client.data.user as SocketUser;
    this.logger.log(`Client disconnected: ${user.userId}`);
    await this.redisService.removeUserFromOnlineList(user.userId);
    this.server.emit('userOffline', { userId: user.userId });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('joinRoom')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const user = client.data.user as SocketUser;
    await client.join(roomId);
    await this.redisService.addUserToRoom(roomId, user.userId);
    client.emit('joinedRoom', roomId);
    this.server
      .to(roomId)
      .emit('userJoinedRoom', { roomId, userId: user.userId });
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('leaveRoom')
  async handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string,
  ) {
    const user = client.data.user as SocketUser;
    await client.leave(roomId);
    await this.redisService.removeUserFromRoom(roomId, user.userId);
    client.emit('leftRoom', roomId);
    this.server
      .to(roomId)
      .emit('userLeftRoom', { roomId, userId: user.userId });
  }

  @UseGuards(WsJwtGuard)
  @UsePipes(MessageValidationPipe, ProfanityFilterPipe)
  @SubscribeMessage('sendMessage')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() messageDto: SendMessageDto,
  ) {
    const user = client.data.user as SocketUser;

    // Check rate limiting
    const canSend = await this.redisService.checkMessageRateLimit(user.userId);
    if (!canSend) {
      throw new Error(
        'Rate limit exceeded. Please wait before sending more messages.',
      );
    }

    // Save message to database
    const savedMessage = await this.chatService.createMessage({
      ...messageDto,
      sender: user.userId,
    });

    // Broadcast message to appropriate recipients
    if (messageDto.roomId) {
      this.server.to(messageDto.roomId).emit('newMessage', savedMessage);
    } else if (messageDto.isPrivate && messageDto.recipients) {
      messageDto.recipients.forEach((recipientId) => {
        this.server
          .to(`user_${recipientId}`)
          .emit('newPrivateMessage', savedMessage);
      });
      client.emit('newPrivateMessage', savedMessage);
    }

    return { status: 'success', message: savedMessage };
  }

  @UseGuards(WsJwtGuard)
  @SubscribeMessage('addReaction')
  async handleAddReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() { messageId, emoji }: { messageId: string; emoji: string },
  ) {
    const user = client.data.user as SocketUser;
    const updatedMessage = await this.chatService.addReaction(
      messageId,
      emoji,
      user.userId,
    );

    // Broadcast updated message to all clients in the room
    if (updatedMessage.roomId) {
      this.server
        .to(updatedMessage.roomId)
        .emit('messageUpdated', updatedMessage);
    } else if (updatedMessage.isPrivate) {
      updatedMessage.recipients.forEach((recipientId) => {
        this.server
          .to(`user_${recipientId}`)
          .emit('messageUpdated', updatedMessage);
      });
      client.emit('messageUpdated', updatedMessage);
    }

    return { status: 'success', message: updatedMessage };
  }
}
