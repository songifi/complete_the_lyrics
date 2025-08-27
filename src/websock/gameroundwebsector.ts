// round.entity.ts
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';

export enum RoundStatus {
  WAITING = 'waiting',
  ACTIVE = 'active',
  FINISHED = 'finished',
  PAUSED = 'paused'
}

@Entity('rounds')
export class Round {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  gameId: string;

  @Column()
  roundNumber: number;

  @Column({ type: 'enum', enum: RoundStatus, default: RoundStatus.WAITING })
  status: RoundStatus;

  @Column({ type: 'jsonb', nullable: true })
  questions: any[];

  @Column({ type: 'int', default: 0 })
  currentQuestionIndex: number;

  @Column({ type: 'int', default: 30 })
  timePerQuestion: number;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  endedAt: Date;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

// player-answer.entity.ts
@Entity('player_answers')
export class PlayerAnswer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roundId: string;

  @Column()
  playerId: string;

  @Column()
  questionIndex: number;

  @Column({ nullable: true })
  answer: string;

  @Column({ type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ type: 'int', default: 0 })
  points: number;

  @Column({ type: 'timestamp' })
  submittedAt: Date;

  @Column({ type: 'int', nullable: true })
  timeToAnswer: number; // milliseconds

  @CreateDateColumn()
  createdAt: Date;
}

// buzz-in.entity.ts
@Entity('buzz_ins')
export class BuzzIn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  roundId: string;

  @Column()
  playerId: string;

  @Column()
  questionIndex: number;

  @Column({ type: 'timestamp' })
  buzzedAt: Date;

  @Column({ type: 'int' })
  buzzOrder: number;

  @Column({ type: 'boolean', default: false })
  wasAnswered: boolean;
}

// round.dto.ts
export class CreateRoundDto {
  gameId: string;
  roundNumber: number;
  questions: any[];
  timePerQuestion?: number;
  settings?: Record<string, any>;
}

export class SubmitAnswerDto {
  roundId: string;
  questionIndex: number;
  answer: string;
}

export class BuzzInDto {
  roundId: string;
  questionIndex: number;
}

export class RoundTimerDto {
  roundId: string;
  timeRemaining: number;
  questionIndex: number;
}

// round.service.ts
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Round, RoundStatus } from './entities/round.entity';
import { PlayerAnswer } from './entities/player-answer.entity';
import { BuzzIn } from './entities/buzz-in.entity';
import { CreateRoundDto, SubmitAnswerDto, BuzzInDto } from './dto/round.dto';

@Injectable()
export class RoundService {
  private readonly logger = new Logger(RoundService.name);
  private roundTimers = new Map<string, NodeJS.Timeout>();
  private questionTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    @InjectRepository(Round)
    private roundRepository: Repository<Round>,
    @InjectRepository(PlayerAnswer)
    private playerAnswerRepository: Repository<PlayerAnswer>,
    @InjectRepository(BuzzIn)
    private buzzInRepository: Repository<BuzzIn>,
  ) {}

  async createRound(createRoundDto: CreateRoundDto): Promise<Round> {
    const round = this.roundRepository.create(createRoundDto);
    return await this.roundRepository.save(round);
  }

  async getRound(id: string): Promise<Round> {
    const round = await this.roundRepository.findOne({ where: { id } });
    if (!round) {
      throw new NotFoundException(`Round with ID ${id} not found`);
    }
    return round;
  }

  async startRound(roundId: string): Promise<Round> {
    const round = await this.getRound(roundId);
    round.status = RoundStatus.ACTIVE;
    round.startedAt = new Date();
    round.currentQuestionIndex = 0;
    
    const savedRound = await this.roundRepository.save(round);
    this.startQuestionTimer(roundId);
    
    return savedRound;
  }

  async endRound(roundId: string): Promise<Round> {
    const round = await this.getRound(roundId);
    round.status = RoundStatus.FINISHED;
    round.endedAt = new Date();
    
    this.clearTimers(roundId);
    
    return await this.roundRepository.save(round);
  }

  async nextQuestion(roundId: string): Promise<Round> {
    const round = await this.getRound(roundId);
    
    if (round.currentQuestionIndex < round.questions.length - 1) {
      round.currentQuestionIndex++;
      const savedRound = await this.roundRepository.save(round);
      this.startQuestionTimer(roundId);
      return savedRound;
    } else {
      return await this.endRound(roundId);
    }
  }

  async submitAnswer(playerId: string, submitAnswerDto: SubmitAnswerDto): Promise<PlayerAnswer> {
    const { roundId, questionIndex, answer } = submitAnswerDto;
    const round = await this.getRound(roundId);
    
    if (round.status !== RoundStatus.ACTIVE) {
      throw new Error('Round is not active');
    }

    const submittedAt = new Date();
    const questionStartTime = new Date(round.startedAt.getTime() + (questionIndex * round.timePerQuestion * 1000));
    const timeToAnswer = submittedAt.getTime() - questionStartTime.getTime();

    // Check if answer is correct (you'll need to implement your logic here)
    const isCorrect = this.checkAnswer(round.questions[questionIndex], answer);
    const points = this.calculatePoints(isCorrect, timeToAnswer, round.timePerQuestion);

    const playerAnswer = this.playerAnswerRepository.create({
      roundId,
      playerId,
      questionIndex,
      answer,
      isCorrect,
      points,
      submittedAt,
      timeToAnswer,
    });

    return await this.playerAnswerRepository.save(playerAnswer);
  }

  async buzzIn(playerId: string, buzzInDto: BuzzInDto): Promise<BuzzIn> {
    const { roundId, questionIndex } = buzzInDto;
    const round = await this.getRound(roundId);
    
    if (round.status !== RoundStatus.ACTIVE) {
      throw new Error('Round is not active');
    }

    // Get current buzz order for this question
    const existingBuzzIns = await this.buzzInRepository.count({
      where: { roundId, questionIndex }
    });

    const buzzIn = this.buzzInRepository.create({
      roundId,
      playerId,
      questionIndex,
      buzzedAt: new Date(),
      buzzOrder: existingBuzzIns + 1,
    });

    return await this.buzzInRepository.save(buzzIn);
  }

  async getRoundScores(roundId: string): Promise<any[]> {
    const scores = await this.playerAnswerRepository
      .createQueryBuilder('answer')
      .select('answer.playerId, SUM(answer.points) as totalPoints, COUNT(answer.id) as answersCount')
      .where('answer.roundId = :roundId', { roundId })
      .groupBy('answer.playerId')
      .getRawMany();

    return scores;
  }

  async getBuzzInOrder(roundId: string, questionIndex: number): Promise<BuzzIn[]> {
    return await this.buzzInRepository.find({
      where: { roundId, questionIndex },
      order: { buzzOrder: 'ASC' }
    });
  }

  private startQuestionTimer(roundId: string): void {
    this.clearQuestionTimer(roundId);
    
    const timer = setTimeout(async () => {
      const round = await this.getRound(roundId);
      if (round.status === RoundStatus.ACTIVE) {
        await this.nextQuestion(roundId);
      }
    }, round.timePerQuestion * 1000);

    this.questionTimers.set(roundId, timer);
  }

  private clearTimers(roundId: string): void {
    this.clearQuestionTimer(roundId);
    
    const roundTimer = this.roundTimers.get(roundId);
    if (roundTimer) {
      clearTimeout(roundTimer);
      this.roundTimers.delete(roundId);
    }
  }

  private clearQuestionTimer(roundId: string): void {
    const timer = this.questionTimers.get(roundId);
    if (timer) {
      clearTimeout(timer);
      this.questionTimers.delete(roundId);
    }
  }

  private checkAnswer(question: any, answer: string): boolean {
    // Implement your answer checking logic here
    return question.correctAnswer?.toLowerCase() === answer.toLowerCase();
  }

  private calculatePoints(isCorrect: boolean, timeToAnswer: number, maxTime: number): number {
    if (!isCorrect) return 0;
    
    // Calculate points based on speed (faster answers get more points)
    const timeBonus = Math.max(0, (maxTime * 1000 - timeToAnswer) / 1000);
    const basePoints = 100;
    const speedBonus = Math.floor(timeBonus / maxTime * 50);
    
    return basePoints + speedBonus;
  }
}

// round.gateway.ts
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

// round.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RoundService } from './round.service';
import { CreateRoundDto } from './dto/round.dto';

@Controller('rounds')
export class RoundController {
  constructor(private readonly roundService: RoundService) {}

  @Post()
  async createRound(@Body() createRoundDto: CreateRoundDto) {
    return await this.roundService.createRound(createRoundDto);
  }

  @Get(':id')
  async getRound(@Param('id') id: string) {
    return await this.roundService.getRound(id);
  }

  @Put(':id/start')
  async startRound(@Param('id') id: string) {
    return await this.roundService.startRound(id);
  }

  @Put(':id/end')
  async endRound(@Param('id') id: string) {
    return await this.roundService.endRound(id);
  }

  @Get(':id/scores')
  async getRoundScores(@Param('id') id: string) {
    return await this.roundService.getRoundScores(id);
  }

  @Get(':id/questions/:questionIndex/buzz-ins')
  async getBuzzInOrder(
    @Param('id') id: string,
    @Param('questionIndex') questionIndex: number,
  ) {
    return await this.roundService.getBuzzInOrder(id, questionIndex);
  }
}

// round.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoundService } from './round.service';
import { RoundController } from './round.controller';
import { RoundGateway } from './round.gateway';
import { Round } from './entities/round.entity';
import { PlayerAnswer } from './entities/player-answer.entity';
import { BuzzIn } from './entities/buzz-in.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Round, PlayerAnswer, BuzzIn]),
  ],
  controllers: [RoundController],
  providers: [RoundService, RoundGateway],
  exports: [RoundService],
})
export class RoundModule {}

// Example usage in app.module.ts
/*
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoundModule } from './round/round.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'your_username',
      password: 'your_password',
      database: 'your_database',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // Don't use in production
    }),
    RoundModule,
  ],
})
export class AppModule {}
*/