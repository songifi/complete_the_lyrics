import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatsService } from './user-stats.service';
import { UserStats } from '../entities/user-stats.entity';

describe('UserStatsService', () => {
  let service: UserStatsService;
  let repository: Repository<UserStats>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserStatsService,
        {
          provide: getRepositoryToken(UserStats),
          useClass: Repository,
        },
      ],
    }).compile();

    service = module.get<UserStatsService>(UserStatsService);
    repository = module.get<Repository<UserStats>>(getRepositoryToken(UserStats));
  });

  it('should create new stats for first attempt', async () => {
    const mockStats = {
      id: 1,
      userId: 1,
      totalAttempts: 1,
      correctAttempts: 1,
      score: 10,
      accuracyRate: 100,
    };

    jest.spyOn(repository, 'findOne').mockResolvedValue(null);
    jest.spyOn(repository, 'create').mockReturnValue(mockStats as any);
    jest.spyOn(repository, 'save').mockResolvedValue(mockStats as any);

    const result = await service.createOrUpdateStats({
      userId: 1,
      isCorrect: true,
      pointsEarned: 10,
    });

    expect(result.totalAttempts).toBe(1);
    expect(result.correctAttempts).toBe(1);
    expect(result.score).toBe(10);
  });
});
