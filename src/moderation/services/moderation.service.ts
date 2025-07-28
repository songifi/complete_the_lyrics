import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ModerationCase } from '../entities/moderation-case.entity';
import { ModerationAction } from '../entities/moderation-action.entity';
import { CreateModerationCaseDto } from '../dto/create-moderation-case.dto';
import { ContentAnalyzerService } from './content-analyzer.service';
import { ModerationWorkflowService } from './moderation-workflow.service';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(
    @InjectRepository(ModerationCase)
    private readonly moderationCaseRepository: Repository<ModerationCase>,
    @InjectRepository(ModerationAction)
    private readonly moderationActionRepository: Repository<ModerationAction>,
    @InjectQueue('moderation')
    private readonly moderationQueue: Queue,
    private readonly contentAnalyzer: ContentAnalyzerService,
    private readonly workflowService: ModerationWorkflowService,
  ) {}

  async submitForModeration(
    dto: CreateModerationCaseDto,
  ): Promise<ModerationCase> {
    this.logger.log(`Submitting content ${dto.contentId} for moderation`);

    // Create initial case
    const moderationCase = this.moderationCaseRepository.create({
      contentId: dto.contentId,
      contentType: dto.contentType,
      content: dto.content,
      status: ModerationStatus.PENDING,
      metadata: dto.metadata,
    });

    const savedCase = await this.moderationCaseRepository.save(moderationCase);

    // Add to processing queue with priority based on content type
    const priority = this.calculatePriority(dto.contentType);
    await this.moderationQueue.add(
      'analyze-content',
      {
        caseId: savedCase.id,
        contentType: dto.contentType,
        content: dto.content,
      },
      { priority },
    );

    return savedCase;
  }

  async processAutomatedModeration(caseId: string): Promise<void> {
    const moderationCase = await this.moderationCaseRepository.findOne({
      where: { id: caseId },
    });

    if (!moderationCase) {
      throw new NotFoundException(`Moderation case ${caseId} not found`);
    }

    // Analyze content
    const analysisResult = await this.contentAnalyzer.analyzeContent(
      moderationCase.content,
      moderationCase.contentType,
      moderationCase.contentId,
    );

    // Update case with analysis results
    moderationCase.confidenceScore = analysisResult.confidence;
    moderationCase.escalationLevel = analysisResult.escalationLevel;
    moderationCase.violationDetails = analysisResult.metadata;
    moderationCase.appliedRuleIds = analysisResult.ruleIds;

    if (analysisResult.isViolation) {
      if (
        analysisResult.escalationLevel === EscalationLevel.CRITICAL ||
        analysisResult.escalationLevel === EscalationLevel.HIGH
      ) {
        // Escalate to manual review
        await this.escalateToManualReview(moderationCase);
      } else {
        // Auto-reject low confidence violations
        await this.autoReject(moderationCase, analysisResult);
      }
    } else {
      // Auto-approve clean content
      await this.autoApprove(moderationCase);
    }

    await this.moderationCaseRepository.save(moderationCase);
  }

  async escalateToManualReview(moderationCase: ModerationCase): Promise<void> {
    moderationCase.status = ModerationStatus.ESCALATED;

    await this.createModerationAction(
      moderationCase.id,
      'escalated',
      'system',
      'Escalated due to high confidence violation detection',
    );

    // Add to manual review queue
    await this.moderationQueue.add(
      'manual-review',
      {
        caseId: moderationCase.id,
        escalationLevel: moderationCase.escalationLevel,
      },
      { priority: this.getEscalationPriority(moderationCase.escalationLevel) },
    );
  }

  async autoApprove(moderationCase: ModerationCase): Promise<void> {
    moderationCase.status = ModerationStatus.APPROVED;

    await this.createModerationAction(
      moderationCase.id,
      'auto_approved',
      'system',
      'Automatically approved - no violations detected',
    );

    this.workflowService.transition(moderationCase.id, 'AUTO_APPROVE');
  }

  async autoReject(
    moderationCase: ModerationCase,
    analysisResult: any,
  ): Promise<void> {
    moderationCase.status = ModerationStatus.REJECTED;
    moderationCase.rejectionReason = `Automated rejection: ${analysisResult.violationType}`;

    await this.createModerationAction(
      moderationCase.id,
      'auto_rejected',
      'system',
      moderationCase.rejectionReason,
    );

    this.workflowService.transition(moderationCase.id, 'AUTO_REJECT');
  }

  async manualApprove(
    caseId: string,
    moderatorId: string,
    reason?: string,
  ): Promise<void> {
    const moderationCase = await this.findCaseById(caseId);

    moderationCase.status = ModerationStatus.APPROVED;
    moderationCase.assignedModerator = moderatorId;

    await this.moderationCaseRepository.save(moderationCase);
    await this.createModerationAction(
      caseId,
      'manual_approved',
      moderatorId,
      reason,
    );

    this.workflowService.transition(caseId, 'APPROVE');
  }

  async manualReject(
    caseId: string,
    moderatorId: string,
    reason: string,
  ): Promise<void> {
    const moderationCase = await this.findCaseById(caseId);

    moderationCase.status = ModerationStatus.REJECTED;
    moderationCase.assignedModerator = moderatorId;
    moderationCase.rejectionReason = reason;

    await this.moderationCaseRepository.save(moderationCase);
    await this.createModerationAction(
      caseId,
      'manual_rejected',
      moderatorId,
      reason,
    );

    this.workflowService.transition(caseId, 'REJECT');
  }

  async getManualReviewQueue(
    escalationLevel?: EscalationLevel,
  ): Promise<ModerationCase[]> {
    const queryBuilder = this.moderationCaseRepository
      .createQueryBuilder('case')
      .where('case.status IN (:...statuses)', {
        statuses: [ModerationStatus.ESCALATED, ModerationStatus.UNDER_REVIEW],
      })
      .orderBy('case.createdAt', 'DESC');

    if (escalationLevel) {
      queryBuilder.andWhere('case.escalationLevel = :level', {
        level: escalationLevel,
      });
    }

    return queryBuilder.getMany();
  }

  private async findCaseById(caseId: string): Promise<ModerationCase> {
    const moderationCase = await this.moderationCaseRepository.findOne({
      where: { id: caseId },
    });

    if (!moderationCase) {
      throw new NotFoundException(`Moderation case ${caseId} not found`);
    }

    return moderationCase;
  }

  private async createModerationAction(
    caseId: string,
    action: string,
    performedBy: string,
    reason?: string,
  ): Promise<void> {
    const moderationAction = this.moderationActionRepository.create({
      action,
      performedBy,
      reason,
      moderationCase: { id: caseId } as ModerationCase,
    });

    await this.moderationActionRepository.save(moderationAction);
  }

  private calculatePriority(contentType: string): number {
    const priorityMap = {
      image: 10,
      video: 8,
      text: 5,
      audio: 3,
    };
    return priorityMap[contentType] || 1;
  }

  private getEscalationPriority(escalationLevel: EscalationLevel): number {
    const priorityMap = {
      [EscalationLevel.CRITICAL]: 100,
      [EscalationLevel.HIGH]: 80,
      [EscalationLevel.MEDIUM]: 60,
      [EscalationLevel.LOW]: 40,
    };
    return priorityMap[escalationLevel];
  }
}
