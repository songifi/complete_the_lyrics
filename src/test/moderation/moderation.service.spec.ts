import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { Repository } from 'typeorm';
import { Queue } from 'bull';
import { ModerationService } from '../../moderation/services/moderation.service';
import { ModerationCase } from '../../moderation/entities/moderation-case.entity';
import { ModerationAction } from '../../moderation/entities/moderation-action.entity';
import { ContentAnalyzerService } from '../../moderation/services/content-analyzer.service';
import { ModerationWorkflowService } from '../../moderation/services/moderation-workflow.service';
import { ContentType } from '../../common/enums/content-type.enum';
import { ModerationStatus } from '../../common/enums/moderation-status.enum';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';

describe('ModerationService', () => {
  let service: ModerationService;
  let caseRepository: Repository<ModerationCase>;
  let actionRepository: Repository<ModerationAction>;
  let moderationQueue: Queue;
  let contentAnalyzer: ContentAnalyzerService;
  let workflowService: ModerationWorkflowService;

  const mockCase = {
    id: '123',
    contentId: 'content-456',
    contentType: ContentType.TEXT,
    content: 'Test content',
    status: ModerationStatus.PENDING,
    escalationLevel: EscalationLevel.LOW,
    confidenceScore: 0.5,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModerationService,
        {
          provide: getRepositoryToken(ModerationCase),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              getMany: jest.fn(),
            })),
          },
        },
        {
          provide: getRepositoryToken(ModerationAction),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getQueueToken('moderation'),
          useValue: {
            add: jest.fn(),
          },
        },
        {
          provide: ContentAnalyzerService,
          useValue: {
            analyzeContent: jest.fn(),
          },
        },
        {
          provide: ModerationWorkflowService,
          useValue: {
            transition: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ModerationService>(ModerationService);
    caseRepository = module.get<Repository<ModerationCase>>(
      getRepositoryToken(ModerationCase),
    );
    actionRepository = module.get<Repository<ModerationAction>>(
      getRepositoryToken(ModerationAction),
    );
    moderationQueue = module.get<Queue>(getQueueToken('moderation'));
    contentAnalyzer = module.get<ContentAnalyzerService>(
      ContentAnalyzerService,
    );
    workflowService = module.get<ModerationWorkflowService>(
      ModerationWorkflowService,
    );
  });

  describe('submitForModeration', () => {
    it('should create and queue a moderation case', async () => {
      const dto = {
        contentId: 'content-456',
        contentType: ContentType.TEXT,
        content: 'Test content',
      };

      jest.spyOn(caseRepository, 'create').mockReturnValue(mockCase as any);
      jest.spyOn(caseRepository, 'save').mockResolvedValue(mockCase as any);
      jest.spyOn(moderationQueue, 'add').mockResolvedValue({} as any);

      const result = await service.submitForModeration(dto);

      expect(caseRepository.create).toHaveBeenCalledWith({
        contentId: dto.contentId,
        contentType: dto.contentType,
        content: dto.content,
        status: ModerationStatus.PENDING,
        metadata: undefined,
      });

      expect(moderationQueue.add).toHaveBeenCalledWith(
        'analyze-content',
        {
          caseId: mockCase.id,
          contentType: dto.contentType,
          content: dto.content,
        },
        { priority: 5 },
      );

      expect(result).toEqual(mockCase);
    });
  });

  describe('processAutomatedModeration', () => {
    it('should auto-approve clean content', async () => {
      const analysisResult = {
        isViolation: false,
        confidence: 0.1,
        escalationLevel: EscalationLevel.LOW,
        ruleIds: [],
        metadata: {},
      };

      jest.spyOn(caseRepository, 'findOne').mockResolvedValue(mockCase as any);
      jest
        .spyOn(contentAnalyzer, 'analyzeContent')
        .mockResolvedValue(analysisResult);
      jest.spyOn(caseRepository, 'save').mockResolvedValue(mockCase as any);
      jest.spyOn(actionRepository, 'create').mockReturnValue({} as any);
      jest.spyOn(actionRepository, 'save').mockResolvedValue({} as any);

      await service.processAutomatedModeration(mockCase.id);

      expect(workflowService.transition).toHaveBeenCalledWith(
        mockCase.id,
        'AUTO_APPROVE',
      );
    });

    it('should escalate high-risk violations', async () => {
      const analysisResult = {
        isViolation: true,
        confidence: 0.9,
        escalationLevel: EscalationLevel.CRITICAL,
        ruleIds: ['violence-rule'],
        metadata: {},
      };

      jest.spyOn(caseRepository, 'findOne').mockResolvedValue(mockCase as any);
      jest
        .spyOn(contentAnalyzer, 'analyzeContent')
        .mockResolvedValue(analysisResult);
      jest.spyOn(caseRepository, 'save').mockResolvedValue(mockCase as any);
      jest.spyOn(moderationQueue, 'add').mockResolvedValue({} as any);
      jest.spyOn(actionRepository, 'create').mockReturnValue({} as any);
      jest.spyOn(actionRepository, 'save').mockResolvedValue({} as any);

      await service.processAutomatedModeration(mockCase.id);

      expect(moderationQueue.add).toHaveBeenCalledWith(
        'manual-review',
        {
          caseId: mockCase.id,
          escalationLevel: EscalationLevel.CRITICAL,
        },
        { priority: 100 },
      );
    });
  });

  describe('manualApprove', () => {
    it('should approve case and create action', async () => {
      jest.spyOn(caseRepository, 'findOne').mockResolvedValue(mockCase as any);
      jest.spyOn(caseRepository, 'save').mockResolvedValue(mockCase as any);
      jest.spyOn(actionRepository, 'create').mockReturnValue({} as any);
      jest.spyOn(actionRepository, 'save').mockResolvedValue({} as any);

      await service.manualApprove(mockCase.id, 'moderator-123', 'Looks good');

      expect(workflowService.transition).toHaveBeenCalledWith(
        mockCase.id,
        'APPROVE',
      );
    });
  });
});
