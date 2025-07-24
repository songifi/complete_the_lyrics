import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { RedisModule } from '@nestjs/redis';
import { ModerationCase } from './entities/moderation-case.entity';
import { ModerationRule } from './entities/moderation-rule.entity';
import { ModerationAction } from './entities/moderation-action.entity';
import { ModerationAppeal } from './entities/moderation-appeal.entity';
import { ModerationController } from './controllers/moderation.controller';
import { ModerationService } from './services/moderation.service';
import { ContentAnalyzerService } from './services/content-analyzer.service';
import { TextAnalyzerService } from './services/text-analyzer.service';
import { ImageAnalyzerService } from './services/image-analyzer.service';
import { ModerationWorkflowService } from './services/moderation-workflow.service';
import { ModerationRulesService } from './services/moderation-rules.service';
import { ModerationAppealsService } from './services/moderation-appeals.service';
import { ModerationQueueProcessor } from './processors/moderation-queue.processor';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ModerationCase,
      ModerationRule,
      ModerationAction,
      ModerationAppeal,
    ]),
    BullModule.registerQueue({ name: 'moderation' }, { name: 'appeals' }),
    RedisModule,
  ],
  controllers: [ModerationController],
  providers: [
    ModerationService,
    ContentAnalyzerService,
    TextAnalyzerService,
    ImageAnalyzerService,
    ModerationWorkflowService,
    ModerationRulesService,
    ModerationAppealsService,
    ModerationQueueProcessor,
  ],
  exports: [ModerationService, ContentAnalyzerService],
})
export class ModerationModule {}
