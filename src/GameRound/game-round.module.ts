import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameRound } from './entities/game-round.entity';
import { GameRoundRepository } from './game-round.repository';
import { RoundQuestionGeneratorService } from './round-question-generator.service';
import { GameRoundService } from './services/game-round.service';
import { Song } from './entities/song.entity';
import { GameSession } from './entities/game-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GameRound, Song, GameSession])],
  providers: [
    GameRoundRepository,
    RoundQuestionGeneratorService,
    GameRoundService,
  ],
  exports: [
    GameRoundRepository,
    RoundQuestionGeneratorService,
    GameRoundService,
  ],
})
export class GameRoundModule {}