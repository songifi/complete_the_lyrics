import {
    WebSocketGateway,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
  } from '@nestjs/websockets';
  import { Server, Socket } from 'socket.io';
  import { Logger, UseGuards } from '@nestjs/common';
  import { RoundService } from './round.service';
  import { SubmitAnswerDto, BuzzInDto } from './dto/round.dto';
  
  interface ConnectedClient {
    id: string;
    playerId?: string;
    gameId?: string;
    isSpectator: boolean;
  }
  
  @WebSocketGateway({
    cors: {
      origin: '*',
    },
    namespace: '/rounds'
  })
  export class RoundGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;
  
    private readonly logger = new Logger(RoundGateway.name);
    private connectedClients = new Map<string, ConnectedClient>();
    private gameRooms = new Map<string, Set<string>>();
    private roundTimers = new Map<string, NodeJS.Timeout>();
  
    constructor(private readonly roundService: RoundService) {}
  
    handleConnection(client: Socket) {
      this.logger.log(`Client connected: ${client.id}`);
      this.connectedClients.set(client.id, {
        id: client.id,
        isSpectator: false,
      });
    }
  
    handleDisconnect(client: Socket) {
      this.logger.log(`Client disconnected: ${client.id}`);
      const clientInfo = this.connectedClients.get(client.id);
      
      if (clientInfo?.gameId) {
        const gameRoom = this.gameRooms.get(clientInfo.gameId);
        if (gameRoom) {
          gameRoom.delete(client.id);
          if (gameRoom.size === 0) {
            this.gameRooms.delete(clientInfo.gameId);
          }
        }
      }
      
      this.connectedClients.delete(client.id);
    }
  
    @SubscribeMessage('join-game')
    async handleJoinGame(
      @MessageBody() data: { gameId: string; playerId?: string; isSpectator?: boolean },
      @ConnectedSocket() client: Socket,
    ) {
      const { gameId, playerId, isSpectator = false } = data;
      
      // Update client info
      const clientInfo = this.connectedClients.get(client.id);
      if (clientInfo) {
        clientInfo.gameId = gameId;
        clientInfo.playerId = playerId;
        clientInfo.isSpectator = isSpectator;
      }
  
      // Add to game room
      if (!this.gameRooms.has(gameId)) {
        this.gameRooms.set(gameId, new Set());
      }
      this.gameRooms.get(gameId)!.add(client.id);
  
      // Join socket room
      await client.join(`game-${gameId}`);
      
      this.logger.log(`Client ${client.id} joined game ${gameId} as ${isSpectator ? 'spectator' : 'player'}`);
      
      client.emit('joined-game', { gameId, success: true });
    }
  
    @SubscribeMessage('start-round')
    async handleStartRound(
      @MessageBody() data: { roundId: string },
      @ConnectedSocket() client: Socket,
    ) {
      try {
        const round = await this.roundService.startRound(data.roundId);
        
        // Broadcast round start to all participants
        this.server.to(`game-${round.gameId}`).emit('round-started', {
          round,
          timestamp: Date.now(),
        });
  
        // Start timer synchronization
        this.startRoundTimer(round);
        
        this.logger.log(`Round ${data.roundId} started`);
      } catch (error) {
        client.emit('error', { message: error.message });
      }
    }
  
    @SubscribeMessage('submit-answer')
    async handleSubmitAnswer(
      @MessageBody() data: SubmitAnswerDto,
      @ConnectedSocket() client: Socket,
    ) {
      try {
        const clientInfo = this.connectedClients.get(client.id);
        if (!clientInfo?.playerId) {
          throw new Error('Player ID not found');
        }
  
        const answer = await this.roundService.submitAnswer(clientInfo.playerId, data);
        const round = await this.roundService.getRound(data.roundId);
        
        // Broadcast answer submission to game participants
        this.server.to(`game-${round.gameId}`).emit('answer-submitted', {
          playerId: clientInfo.playerId,
          questionIndex: data.questionIndex,
          timestamp: Date.now(),
          // Don't reveal if answer is correct until question ends
        });
  
        // Send confirmation to submitter
        client.emit('answer-confirmed', {
          success: true,
          timestamp: Date.now(),
        });
  
      } catch (error) {
        client.emit('error', { message: error.message });
      }
    }
  
    @SubscribeMessage('buzz-in')
    async handleBuzzIn(
      @MessageBody() data: BuzzInDto,
      @ConnectedSocket() client: Socket,
    ) {
      try {
        const clientInfo = this.connectedClients.get(client.id);
        if (!clientInfo?.playerId) {
          throw new Error('Player ID not found');
        }
  
        const buzzIn = await this.roundService.buzzIn(clientInfo.playerId, data);
        const round = await this.roundService.getRound(data.roundId);
        
        // Broadcast buzz-in to all participants
        this.server.to(`game-${round.gameId}`).emit('player-buzzed', {
          playerId: clientInfo.playerId,
          buzzOrder: buzzIn.buzzOrder,
          questionIndex: data.questionIndex,
          timestamp: Date.now(),
        });
  
      } catch (error) {
        client.emit('error', { message: error.message });
      }
    }
  
    @SubscribeMessage('get-scores')
    async handleGetScores(
      @MessageBody() data: { roundId: string },
      @ConnectedSocket() client: Socket,
    ) {
      try {
        const scores = await this.roundService.getRoundScores(data.roundId);
        client.emit('scores-update', { scores, timestamp: Date.now() });
      } catch (error) {
        client.emit('error', { message: error.message });
      }
    }
  
    private startRoundTimer(round: any) {
      const roundId = round.id;
      const gameId = round.gameId;
      
      // Clear existing timer
      const existingTimer = this.roundTimers.get(roundId);
      if (existingTimer) {
        clearInterval(existingTimer);
      }
  
      // Start timer that broadcasts every second
      const timer = setInterval(async () => {
        try {
          const currentRound = await this.roundService.getRound(roundId);
          
          if (currentRound.status !== 'active') {
            clearInterval(timer);
            this.roundTimers.delete(roundId);
            return;
          }
  
          const questionStartTime = new Date(currentRound.startedAt.getTime() + 
            (currentRound.currentQuestionIndex * currentRound.timePerQuestion * 1000));
          const timeElapsed = Date.now() - questionStartTime.getTime();
          const timeRemaining = Math.max(0, (currentRound.timePerQuestion * 1000) - timeElapsed);
  
          // Broadcast timer update
          this.server.to(`game-${gameId}`).emit('timer-update', {
            roundId,
            questionIndex: currentRound.currentQuestionIndex,
            timeRemaining: Math.ceil(timeRemaining / 1000),
            timestamp: Date.now(),
          });
  
          // If time is up, move to next question
          if (timeRemaining <= 0) {
            const updatedRound = await this.roundService.nextQuestion(roundId);
            
            if (updatedRound.status === 'finished') {
              // Round finished
              const finalScores = await this.roundService.getRoundScores(roundId);
              this.server.to(`game-${gameId}`).emit('round-ended', {
                round: updatedRound,
                finalScores,
                timestamp: Date.now(),
              });
              
              clearInterval(timer);
              this.roundTimers.delete(roundId);
            } else {
              // Next question
              this.server.to(`game-${gameId}`).emit('question-changed', {
                round: updatedRound,
                questionIndex: updatedRound.currentQuestionIndex,
                timestamp: Date.now(),
              });
            }
          }
        } catch (error) {
          this.logger.error(`Timer error for round ${roundId}:`, error);
          clearInterval(timer);
          this.roundTimers.delete(roundId);
        }
      }, 1000);
  
      this.roundTimers.set(roundId, timer);
    }
  }