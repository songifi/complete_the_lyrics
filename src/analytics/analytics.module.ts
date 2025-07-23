import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ModerationCase } from '../moderation/entities/moderation-case.entity';
import { ModerationAnalyticsService } from './services/moderation-analytics.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ModerationCase]),
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
    }),
  ],
  providers: [ModerationAnalyticsService],
  exports: [ModerationAnalyticsService],
})
export class AnalyticsModule {}
