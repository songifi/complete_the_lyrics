import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ModerationAppeal } from '../entities/moderation-appeal.entity';
import { ModerationCase } from '../entities/moderation-case.entity';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';

export interface CreateAppealDto {
  moderationCaseId: string;
  appealedBy: string;
  appealReason: string;
}

@Injectable()
export class ModerationAppealsService {
  private readonly logger = new Logger(ModerationAppealsService.name);

  constructor(
    @InjectRepository(ModerationAppeal)
    private readonly appealRepository: Repository<ModerationAppeal>,
    @InjectRepository(ModerationCase)
    private readonly caseRepository: Repository<ModerationCase>,
    @InjectQueue('appeals')
    private readonly appealsQueue: Queue,
  ) {}

  async createAppeal(dto: CreateAppealDto): Promise<ModerationAppeal> {
    // Verify the case exists and can be appealed
    const moderationCase = await this.caseRepository.findOne({
      where: { id: dto.moderationCaseId },
    });

    if (!moderationCase) {
      throw new NotFoundException('Moderation case not found');
    }

    if (moderationCase.status !== ModerationStatus.REJECTED) {
      throw new Error('Only rejected cases can be appealed');
    }

    // Check if appeal already exists
    const existingAppeal = await this.appealRepository.findOne({
      where: { moderationCaseId: dto.moderationCaseId },
    });

    if (existingAppeal) {
      throw new Error('Appeal already exists for this case');
    }

    const appeal = this.appealRepository.create({
      moderationCaseId: dto.moderationCaseId,
      appealedBy: dto.appealedBy,
      appealReason: dto.appealReason,
      status: ModerationStatus.PENDING,
    });

    const savedAppeal = await this.appealRepository.save(appeal);

    // Update original case status
    await this.caseRepository.update(dto.moderationCaseId, {
      status: ModerationStatus.APPEALED,
    });

    // Add to appeals queue
    await this.appealsQueue.add('process-appeal', {
      appealId: savedAppeal.id,
      caseId: dto.moderationCaseId,
    });

    return savedAppeal;
  }

  async processAppeal(
    appealId: string,
    reviewerId: string,
    decision: 'approve' | 'reject',
    reason: string,
  ): Promise<void> {
    const appeal = await this.appealRepository.findOne({
      where: { id: appealId },
    });

    if (!appeal) {
      throw new NotFoundException('Appeal not found');
    }

    appeal.status =
      decision === 'approve'
        ? ModerationStatus.APPROVED
        : ModerationStatus.REJECTED;
    appeal.reviewedBy = reviewerId;
    appeal.reviewDecision = reason;

    await this.appealRepository.save(appeal);

    // Update original case status
    const newCaseStatus =
      decision === 'approve'
        ? ModerationStatus.APPROVED
        : ModerationStatus.REJECTED;
    await this.caseRepository.update(appeal.moderationCaseId, {
      status: newCaseStatus,
    });
  }

  async getPendingAppeals(): Promise<ModerationAppeal[]> {
    return this.appealRepository.find({
      where: { status: ModerationStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }
}
