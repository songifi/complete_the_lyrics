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