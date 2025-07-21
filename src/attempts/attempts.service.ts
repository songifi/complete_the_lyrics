import { Injectable } from '@nestjs/common';
import { Attempt } from './entities/attempt.entity';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { Repository } from 'typeorm';

@Injectable()
export class AttemptsService {
  constructor(private readonly attemptRepo: Repository<Attempt>) {}

  async submitAttempt(
    userId: string,
    dto: SubmitAttemptDto,
    correctCompletion: string,
  ): Promise<{ isCorrect: boolean; score: number }> {
    const normalize = (text: string) =>
      text.trim().toLowerCase().replace(/\s+/g, ' ');

    const submitted = normalize(dto.submittedText);
    const correct = normalize(correctCompletion);

    const isCorrect = submitted === correct;
    const score = isCorrect
      ? 100
      : this.calculateSimilarity(submitted, correct);

    const attempt = this.attemptRepo.create({
      userId,
      lyricsId: dto.lyricsId,
      submittedText: dto.submittedText,
      isCorrect,
      score,
    });

    await this.attemptRepo.save(attempt);

    return { isCorrect, score };
  }

  async getUserAttempts(userId: string): Promise<Attempt[]> {
    return this.attemptRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async getAllAttempts(filter: {
    userId?: string;
    isCorrect?: boolean;
    skip?: number;
    take?: number;
  }): Promise<Attempt[]> {
    const qb = this.attemptRepo.createQueryBuilder('attempt');

    if (filter.userId)
      qb.andWhere('attempt.userId = :userId', { userId: filter.userId });
    if (filter.isCorrect !== undefined)
      qb.andWhere('attempt.isCorrect = :isCorrect', {
        isCorrect: filter.isCorrect,
      });
    if (filter.skip) qb.skip(filter.skip);
    if (filter.take) qb.take(filter.take);

    return qb.orderBy('attempt.createdAt', 'DESC').getMany();
  }

  async getAttemptsForExport({
    userId,
    from,
    to,
    category,
  }: {
    userId?: string;
    from?: string;
    to?: string;
    category?: string;
  }) {
    // Implement actual filtering logic as needed
    const query = this.attemptRepo.createQueryBuilder('attempt');
    if (userId) query.andWhere('attempt.userId = :userId', { userId });
    if (from) query.andWhere('attempt.createdAt >= :from', { from });
    if (to) query.andWhere('attempt.createdAt <= :to', { to });
    // category filtering would require a join if category is not in attempts
    return query.getMany();
  }

  private calculateSimilarity(a: string, b: string): number {
    const wordsA = a.split(' ');
    const wordsB = b.split(' ');
    const match = wordsA.filter((word) => wordsB.includes(word)).length;
    return Math.round((match / Math.max(wordsA.length, wordsB.length)) * 100);
  }
}
