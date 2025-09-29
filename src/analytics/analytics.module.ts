import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerAnalyticsService } from './services/answer-analytics.service';
import { CheatingDetectionService } from './services/cheating-detection.service';
import { DifficultyAdjustmentService } from './services/difficulty-adjustment.service';
import { ImprovementSuggestionsService } from './services/improvement-suggestions.service';
import { AnalyticsIntegrationService } from './services/analytics-integration.service';
import { AnalyticsController } from './controllers/analytics.controller';
import { PlayerPerformance } from './entities/player-performance.entity';
import { AnswerPattern } from './entities/answer-pattern.entity';
import { AnalyticsSession } from './entities/analytics-session.entity';
import { GameRound } from '../GameRound/entities/game-round.entity';
import { GameSession } from '../GameRound/entities/game-session.entity';
import { User } from '../User/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlayerPerformance,
      AnswerPattern,
      AnalyticsSession,
      GameRound,
      GameSession,
      User,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [
    AnswerAnalyticsService,
    CheatingDetectionService,
    DifficultyAdjustmentService,
    ImprovementSuggestionsService,
    AnalyticsIntegrationService,
  ],
  exports: [
    AnswerAnalyticsService,
    CheatingDetectionService,
    DifficultyAdjustmentService,
    ImprovementSuggestionsService,
    AnalyticsIntegrationService,
  ],
})
export class AnalyticsModule {}
