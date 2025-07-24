import { Test, TestingModule } from '@nestjs/testing';
import { ContentAnalyzerService } from '../../moderation/services/content-analyzer.service';
import { TextAnalyzerService } from '../../moderation/services/text-analyzer.service';
import { ImageAnalyzerService } from '../../moderation/services/image-analyzer.service';
import { ContentType } from '../../common/enums/content-type.enum';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';

describe('ContentAnalyzerService', () => {
  let service: ContentAnalyzerService;
  let textAnalyzer: TextAnalyzerService;
  let imageAnalyzer: ImageAnalyzerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentAnalyzerService,
        {
          provide: TextAnalyzerService,
          useValue: {
            analyze: jest.fn(),
          },
        },
        {
          provide: ImageAnalyzerService,
          useValue: {
            analyze: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContentAnalyzerService>(ContentAnalyzerService);
    textAnalyzer = module.get<TextAnalyzerService>(TextAnalyzerService);
    imageAnalyzer = module.get<ImageAnalyzerService>(ImageAnalyzerService);
  });

  it('should analyze text content', async () => {
    const mockResult = {
      isViolation: false,
      confidence: 0.2,
      escalationLevel: EscalationLevel.LOW,
      ruleIds: [],
    };

    jest.spyOn(textAnalyzer, 'analyze').mockResolvedValue(mockResult);

    const result = await service.analyzeContent(
      'Hello world',
      ContentType.TEXT,
      'content-123',
    );

    expect(textAnalyzer.analyze).toHaveBeenCalledWith('Hello world');
    expect(result).toEqual(mockResult);
  });

  it('should analyze image content', async () => {
    const mockResult = {
      isViolation: true,
      confidence: 0.8,
      escalationLevel: EscalationLevel.HIGH,
      ruleIds: ['adult-content-rule'],
    };

    jest.spyOn(imageAnalyzer, 'analyze').mockResolvedValue(mockResult);

    const result = await service.analyzeContent(
      'https://example.com/image.jpg',
      ContentType.IMAGE,
      'content-123',
    );

    expect(imageAnalyzer.analyze).toHaveBeenCalledWith(
      'https://example.com/image.jpg',
    );
    expect(result).toEqual(mockResult);
  });

  it('should handle analysis errors gracefully', async () => {
    jest
      .spyOn(textAnalyzer, 'analyze')
      .mockRejectedValue(new Error('Analysis failed'));

    const result = await service.analyzeContent(
      'Test content',
      ContentType.TEXT,
      'content-123',
    );

    expect(result.isViolation).toBe(false);
    expect(result.escalationLevel).toBe(EscalationLevel.MEDIUM);
    expect(result.metadata?.error).toBe('Analysis failed');
  });
});
