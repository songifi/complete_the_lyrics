import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Achievement } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { AchievementProgress } from '../entities/achievement-progress.entity';

@Injectable()
export class AchievementRepository {
  constructor(
    @InjectRepository(Achievement)
    private readonly achievementRepo: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private readonly userAchievementRepo: Repository<UserAchievement>,
    @InjectRepository(AchievementProgress)
    private readonly progressRepo: Repository<AchievementProgress>,
  ) {}

  async findEligibleByAction(userId: string, action: string, category?: string) {
    const where: any = { triggerAction: action, isActive: true };
    if (category !== undefined && category !== null) {
      where.category = category;
    }

    const candidates = await this.achievementRepo.find({
      where,
    });

    if (!candidates.length) return [] as Achievement[];

    const withPrereqs = candidates.filter((a) => a.prerequisiteIds?.length);
    if (!withPrereqs.length) return candidates;


    const unlocked = await this.userAchievementRepo.find({
      where: { userId },
      relations: ['achievement'],
    });
    const unlockedIds = new Set(unlocked.filter(u => u.status === 'unlocked').map(u => u.achievement.id));

    return candidates.filter((a) =>
      (a.prerequisiteIds || []).every((id) => unlockedIds.has(id)),
    );
  }

  async getUserProgressForAchievements(userId: string, achievementIds: string[]) {
    if (!achievementIds.length) return [] as AchievementProgress[];
    return this.progressRepo.find({
      where: {
        userId,
        achievement: { id: In(achievementIds) },
      },
      relations: ['achievement'],
    });
  }

  async getLeaderboard(category?: string) {
    const qb = this.userAchievementRepo
      .createQueryBuilder('ua')
      .leftJoin('ua.achievement', 'a')
      .select('ua.userId', 'userId')
      .addSelect('COUNT(ua.id)', 'achievementCount')
      .addSelect('SUM(a.points)', 'totalPoints')
      .where('ua.status = :status', { status: 'unlocked' })
      .groupBy('ua.userId');

    if (category) qb.andWhere('a.category = :category', { category });

    return qb
      .orderBy('totalPoints', 'DESC')
      .addOrderBy('achievementCount', 'DESC')
      .limit(100)
      .getRawMany();
  }
}


