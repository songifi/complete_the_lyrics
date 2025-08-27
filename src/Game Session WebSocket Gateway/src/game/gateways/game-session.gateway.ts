import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { GameSessionService } from '../services/game-session.service';
import { RoomManagerService } from '../services/room-manager.service';
import { PlayerPresenceService } from '../services/player-presence.service';
import { ConnectionRecoveryService } from '../services/connection-recovery.service';
import { CreateSessionDto } from '../dto/create-session.dto';
import { JoinSessionDto } from '../dto/join-session.dto';
import { ChatMessageDto } from '../dto/chat-message.dto';
import { SessionStateUpdateDto } from '../dto/session-state.dto';
import { SessionAuthGuard } from '../guards/session-auth.guard';
import { CurrentPlayer } from '../../common/decorators/current-player.decorator';

@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  path: '/game-socket',
})
@UsePipes(new ValidationPipe({ transform: true }))
export class GameSessionGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(GameSessionGateway.name);

  constructor(
    private gameSessionService: GameSessionService,
    private roomManagerService: RoomManagerService,
    private playerPresenceService: PlayerPresenceService,
    private connectionRecoveryService: ConnectionRecoveryService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
    this.connectionRecoveryService.startCleanupTimer();
    
    // Start presence cleanup timer
    setInterval(async () => {
      await this.playerPresenceService.cleanupStalePresences();
    }, 300000); // Every 5 minutes
  }

  async handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    
    client.emit('connection:established', {
      socketId: client.id,
      timestamp: new Date(),
    });
  }

  async handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    
    const connectionState = this.connectionRecoveryService.getConnectionState(client.id);
    
    if (connectionState) {
      await this.playerPresenceService.setPlayerOffline(connectionState.playerId, client.id);
      this.roomManagerService.leaveRoom(connectionState.sessionId, client.id);
      
      // Broadcast player left to room
      this.roomManagerService.broadcastToRoom(
        connectionState.sessionId,
        'player:left',
        { playerId: connectionState.playerId, socketId: client.id },
        this.server,
        client.emit('session:created', {
        success: true,
        session,
        playerId,
      });

      this.logger.log(`Session created: ${session.id} by player: ${playerId}`);
    } catch (error) {
      this.logger.error(`Failed to create session: ${error.message}`);
      client.emit('session:error', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('session:join')
  async handleJoinSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() joinSessionDto: JoinSessionDto,
  ) {
    try {
      const playerId = this.getPlayerIdFromSocket(client);
      const { session, player } = await this.gameSessionService.joinSession(joinSessionDto, playerId);
      
      // Join room
      const joined = this.roomManagerService.joinRoom(session.id, client);
      if (!joined) {
        throw new Error('Failed to join session room');
      }
      
      // Set up presence and connection state
      await this.playerPresenceService.setPlayerOnline(playerId, client.id);
      this.connectionRecoveryService.saveConnectionState(client, playerId, session.id);
      
      // Get online players for presence update
      const onlinePlayers = await this.playerPresenceService.getOnlinePlayersInSession(session.id);
      
      // Notify client of successful join
      client.emit('session:joined', {
        success: true,
        session,
        player,
        onlinePlayers,
      });
      
      // Broadcast to room that new player joined
      this.roomManagerService.broadcastToRoom(
        session.id,
        'player:joined',
        { player, onlinePlayers },
        this.server,
        client.id
      );
      
      this.logger.log(`Player ${playerId} joined session: ${session.id}`);
    } catch (error) {
      this.logger.error(`Failed to join session: ${error.message}`);
      client.emit('session:error', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('session:leave')
  @UseGuards(SessionAuthGuard)
  async handleLeaveSession(
    @ConnectedSocket() client: Socket,
    @CurrentPlayer() playerId: string,
  ) {
    try {
      const connectionState = this.connectionRecoveryService.getConnectionState(client.id);
      if (!connectionState) {
        throw new Error('No active session found');
      }
      
      await this.gameSessionService.leaveSession(connectionState.sessionId, playerId);
      
      // Update presence and leave room
      await this.playerPresenceService.setPlayerOffline(playerId, client.id);
      this.roomManagerService.leaveRoom(connectionState.sessionId, client.id);
      
      // Broadcast player left
      this.roomManagerService.broadcastToRoom(
        connectionState.sessionId,
        'player:left',
        { playerId, socketId: client.id },
        this.server,
        client.id
      );
      
      client.emit('session:left', { success: true });
      this.connectionRecoveryService.removeConnectionState(client.id);
      
      this.logger.log(`Player ${playerId} left session: ${connectionState.sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to leave session: ${error.message}`);
      client.emit('session:error', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('chat:send')
  @UseGuards(SessionAuthGuard)
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() chatMessageDto: ChatMessageDto,
    @CurrentPlayer() playerId: string,
  ) {
    try {
      const connectionState = this.connectionRecoveryService.getConnectionState(client.id);
      if (!connectionState) {
        throw new Error('No active session found');
      }
      
      const message = await this.gameSessionService.sendChatMessage(
        connectionState.sessionId,
        playerId,
        chatMessageDto
      );
      
      // Broadcast message to room
      const messageData = {
        id: message.id,
        content: message.content,
        type: message.type,
        sender: {
          id: message.sender.id,
          username: message.sender.username,
        },
        targetPlayerId: message.targetPlayerId,
        createdAt: message.createdAt,
      };
      
      if (chatMessageDto.targetPlayerId) {
        // Private message - send to target player only
        const targetSockets = this.roomManagerService.getRoomSockets(connectionState.sessionId)
          .filter(socket => {
            const state = this.connectionRecoveryService.getConnectionState(socket.id);
            return state?.playerId === chatMessageDto.targetPlayerId;
          });
        
        targetSockets.forEach(socket => {
          socket.emit('chat:message', messageData);
        });
        
        // Also send to sender
        client.emit('chat:message', messageData);
      } else {
        // Public message - broadcast to room
        this.roomManagerService.broadcastToRoom(
          connectionState.sessionId,
          'chat:message',
          messageData,
          this.server
        );
      }
      
      this.logger.log(`Message sent in session ${connectionState.sessionId} by player ${playerId}`);
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      client.emit('chat:error', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('session:updateState')
  @UseGuards(SessionAuthGuard)
  async handleUpdateSessionState(
    @ConnectedSocket() client: Socket,
    @MessageBody() sessionStateDto: SessionStateUpdateDto,
    @CurrentPlayer() playerId: string,
  ) {
    try {
      const connectionState = this.connectionRecoveryService.getConnectionState(client.id);
      if (!connectionState) {
        throw new Error('No active session found');
      }
      
      // Verify session ID matches
      if (sessionStateDto.sessionId !== connectionState.sessionId) {
        throw new Error('Session ID mismatch');
      }
      
      const updatedSession = await this.gameSessionService.updateSessionState(sessionStateDto);
      
      // Update connection state cache
      this.connectionRecoveryService.updateSessionData(client.id, sessionStateDto.gameData || {});
      
      // Broadcast state update to room
      this.roomManagerService.broadcastToRoom(
        connectionState.sessionId,
        'session:stateUpdated',
        {
          sessionId: updatedSession.id,
          gameData: updatedSession.gameData,
          updatedBy: playerId,
          timestamp: new Date(),
        },
        this.server,
        client.id
      );
      
      client.emit('session:stateUpdateSuccess', { success: true });
      this.logger.log(`Session state updated: ${connectionState.sessionId} by player: ${playerId}`);
    } catch (error) {
      this.logger.error(`Failed to update session state: ${error.message}`);
      client.emit('session:error', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('session:reconnect')
  async handleReconnect(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { playerId: string },
  ) {
    try {
      const recoveredState = await this.connectionRecoveryService.handleReconnection(client, data.playerId);
      
      if (recoveredState) {
        // Rejoin room
        this.roomManagerService.joinRoom(recoveredState.sessionId, client);
        
        // Update presence
        await this.playerPresenceService.setPlayerOnline(data.playerId, client.id);
        
        // Get current session data
        const session = await this.gameSessionService.getSessionById(recoveredState.sessionId);
        const onlinePlayers = await this.playerPresenceService.getOnlinePlayersInSession(recoveredState.sessionId);
        const chatHistory = await this.gameSessionService.getChatHistory(recoveredState.sessionId, 20);
        
        client.emit('session:reconnected', {
          success: true,
          session,
          onlinePlayers,
          chatHistory: chatHistory.reverse(), // Most recent first
          recoveredData: recoveredState.sessionData,
        });
        
        // Broadcast reconnection to room
        this.roomManagerService.broadcastToRoom(
          recoveredState.sessionId,
          'player:reconnected',
          { playerId: data.playerId, socketId: client.id },
          this.server,
          client.id
        );
        
        this.logger.log(`Player ${data.playerId} successfully reconnected to session ${recoveredState.sessionId}`);
      } else {
        client.emit('session:reconnectFailed', {
          success: false,
          error: 'No recoverable session found or max attempts exceeded',
        });
      }
    } catch (error) {
      this.logger.error(`Reconnection failed: ${error.message}`);
      client.emit('session:reconnectFailed', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('presence:heartbeat')
  @UseGuards(SessionAuthGuard)
  async handleHeartbeat(
    @ConnectedSocket() client: Socket,
    @CurrentPlayer() playerId: string,
  ) {
    try {
      const connectionState = this.connectionRecoveryService.getConnectionState(client.id);
      if (connectionState) {
        await this.playerPresenceService.setPlayerOnline(playerId, client.id);
        this.connectionRecoveryService.updateSessionData(client.id, {});
        
        client.emit('presence:heartbeatAck', { timestamp: new Date() });
      }
    } catch (error) {
      this.logger.error(`Heartbeat failed: ${error.message}`);
    }
  }

  @SubscribeMessage('session:getState')
  @UseGuards(SessionAuthGuard)
  async handleGetSessionState(
    @ConnectedSocket() client: Socket,
    @CurrentPlayer() playerId: string,
  ) {
    try {
      const connectionState = this.connectionRecoveryService.getConnectionState(client.id);
      if (!connectionState) {
        throw new Error('No active session found');
      }
      
      const session = await this.gameSessionService.getSessionById(connectionState.sessionId);
      const onlinePlayers = await this.playerPresenceService.getOnlinePlayersInSession(connectionState.sessionId);
      
      client.emit('session:currentState', {
        session,
        onlinePlayers,
        roomCount: this.roomManagerService.getRoomCount(connectionState.sessionId),
      });
    } catch (error) {
      this.logger.error(`Failed to get session state: ${error.message}`);
      client.emit('session:error', {
        success: false,
        error: error.message,
      });
    }
  }

  @SubscribeMessage('chat:getHistory')
  @UseGuards(SessionAuthGuard)
  async handleGetChatHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { limit?: number },
    @CurrentPlayer() playerId: string,
  ) {
    try {
      const connectionState = this.connectionRecoveryService.getConnectionState(client.id);
      if (!connectionState) {
        throw new Error('No active session found');
      }
      
      const chatHistory = await this.gameSessionService.getChatHistory(
        connectionState.sessionId,
        data.limit || 50
      );
      
      client.emit('chat:history', {
        messages: chatHistory.reverse(), // Most recent first
        sessionId: connectionState.sessionId,
      });
    } catch (error) {
      this.logger.error(`Failed to get chat history: ${error.message}`);
      client.emit('chat:error', {
        success: false,
        error: error.message,
      });
    }
  }

  private getPlayerIdFromSocket(client: Socket): string {
    // Extract player ID from socket handshake or generate one
    // This would typically come from authentication
    return client.handshake.query.playerId as string || `player_${Date.now()}`;
  }
}