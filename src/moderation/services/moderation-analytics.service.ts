import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ModerationCase } from '../../moderation/entities/moderation-case.entity';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';

export interface ModerationMetrics {
  totalCases: number;
  autoApproved: number;
  autoRejected: number;
  manualReview: number;
  appealRate: number;
  averageProcessingTime: number;
  accuracyRate: number;
}

@Injectable()
export class ModerationAnalyticsService {
  private readonly logger = new Logger(ModerationAnalyticsService.name);

  constructor(
    @InjectRepository(ModerationCase)
    private readonly caseRepository: Repository<ModerationCase>,
    private readonly elasticsearchService: ElasticsearchService,
  ) {}

  async getMetrics(startDate: Date, endDate: Date): Promise<ModerationMetrics> {
    const cases = await this.caseRepository
      .createQueryBuilder('case')
      .leftJoinAndSelect('case.actions', 'actions')
      .where('case.createdAt BETWEEN :startDate AND :endDate', {
        startDate,
        endDate,
      })
      .getMany();

    const totalCases = cases.length;
    const autoApproved = cases.filter((c) =>
      c.actions.some((a) => a.action === 'auto_approved'),
    ).length;
    const autoRejected = cases.filter((c) =>
      c.actions.some((a) => a.action === 'auto_rejected'),
    ).length;
    const manualReview = cases.filter(
      (c) =>
        c.status === ModerationStatus.ESCALATED ||
        c.status === ModerationStatus.UNDER_REVIEW,
    ).length;

    // Calculate processing times
    const processingTimes = cases
      .filter(
        (c) =>
          c.status === ModerationStatus.APPROVED ||
          c.status === ModerationStatus.REJECTED,
      )
      .map((c) => {
        const created = new Date(c.createdAt).getTime();
        const updated = new Date(c.updatedAt).getTime();
        return (updated - created) / 1000 / 60; // minutes
      });

    const averageProcessingTime =
      processingTimes.length > 0
        ? processingTimes.reduce((sum, time) => sum + time, 0) /
          processingTimes.length
        : 0;

    // Index metrics to Elasticsearch
    await this.indexMetrics({
      timestamp: new Date(),
      totalCases,
      autoApproved,
      autoRejected,
      manualReview,
      averageProcessingTime,
    });

    return {
      totalCases,
      autoApproved,
      autoRejected,
      manualReview,
      appealRate: 0, // Calculate from appeals table
      averageProcessingTime,
      accuracyRate: this.calculateAccuracyRate(cases),
    };
  }

  private calculateAccuracyRate(cases: ModerationCase[]): number {
    // Simplified accuracy calculation
    const completedCases = cases.filter(
      (c) =>
        c.status === ModerationStatus.APPROVED ||
        c.status === ModerationStatus.REJECTED,
    );

    if (completedCases.length === 0) return 0;

    const accurateCases = completedCases.filter((c) => {
      // Consider high-confidence automated decisions as accurate
      return c.confidenceScore > 0.8;
    });

    return (accurateCases.length / completedCases.length) * 100;
  }

  private async indexMetrics(metrics: any): Promise<void> {
    try {
      await this.elasticsearchService.index({
        index: 'moderation-metrics',
        body: metrics,
      });
    } catch (error) {
      this.logger.error('Failed to index metrics:', error);
    }
  }
}
