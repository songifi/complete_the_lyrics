import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserStatsService } from './user-stats.service';

// Assuming you have an Attempt entity
export interface AttemptDto {
  userId: number;
  questionId: number;
  answer: string;
  isCorrect: boolean;
  pointsEarned: number;
}

@Injectable()
export class AttemptService {
  constructor(
    @InjectRepository(Attempt)
    private attemptRepository: Repository<Attempt>,
    private userStatsService: UserStatsService,
  ) {}

  async createAttempt(attemptData: AttemptDto): Promise<Attempt> {
    // Save the attempt
    const attempt = this.attemptRepository.create(attemptData);
    const savedAttempt = await this.attemptRepository.save(attempt);

    // Update user stats automatically
    await this.userStatsService.createOrUpdateStats({
      userId: attemptData.userId,
      isCorrect: attemptData.isCorrect,
      pointsEarned: attemptData.pointsEarned,
    });

    return savedAttempt;
  }

  // ... other attempt methods
}