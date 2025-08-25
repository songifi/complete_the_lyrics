import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameRound } from './entities/game-round.entity';
import { GameRoundRepository } from './game-round.repository';
import { RoundQuestionGeneratorService } from './round-question-generator.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameRound])],
  providers: [
    GameRoundRepository,
    RoundQuestionGeneratorService,
  ],
  exports: [
    GameRoundRepository,
    RoundQuestionGeneratorService,
  ],
})
export class GameRoundModule {}