import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserActivity, ActivityType } from '../entities/user-activity.entity';
import { UserProfile } from '../entities/user-profile.entity';

@Injectable()
export class UserActivityService {
  constructor(
    @InjectRepository(UserActivity)
    private userActivityRepository: Repository<UserActivity>,
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
  ) {}

  async logActivity(
    userId: string,
    activityType: ActivityType,
    metadata?: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<UserActivity> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    const activity = this.userActivityRepository.create({
      userProfileId: profile.id,
      activityType,
      description: UserActivity.createDescription(activityType, metadata),
      metadata,
      ipAddress,
      userAgent,
    });

    const savedActivity = await this.userActivityRepository.save(activity);

    // Update profile last active timestamp
    profile.updateLastActive();
    await this.userProfileRepository.save(profile);

    return savedActivity;
  }

  async getUserActivities(
    userId: string,
    limit: number = 50,
    offset: number = 0,
    activityTypes?: ActivityType[],
  ): Promise<UserActivity[]> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    const query = this.userActivityRepository
      .createQueryBuilder('activity')
      .where('activity.userProfileId = :profileId', { profileId: profile.id })
      .orderBy('activity.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (activityTypes && activityTypes.length > 0) {
      query.andWhere('activity.activityType IN (:...types)', { types: activityTypes });
    }

    return query.getMany();
  }

  async getActivityStats(userId: string, days: number = 30): Promise<any> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const activities = await this.userActivityRepository
      .createQueryBuilder('activity')
      .select('activity.activityType', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('activity.userProfileId = :profileId', { profileId: profile.id })
      .andWhere('activity.createdAt >= :startDate', { startDate })
      .groupBy('activity.activityType')
      .getRawMany();

    const stats = {};
    activities.forEach(activity => {
      stats[activity.type] = parseInt(activity.count);
    });

    return {
      period: `${days} days`,
      startDate,
      endDate: new Date(),
      totalActivities: activities.reduce((sum, activity) => sum + parseInt(activity.count), 0),
      byType: stats,
    };
  }

  async getRecentActivities(userId: string, limit: number = 10): Promise<UserActivity[]> {
    return this.getUserActivities(userId, limit, 0);
  }

  async getActivitiesByType(
    userId: string,
    activityType: ActivityType,
    limit: number = 50,
    offset: number = 0,
  ): Promise<UserActivity[]> {
    return this.getUserActivities(userId, limit, offset, [activityType]);
  }

  async deleteOldActivities(userId: string, daysToKeep: number = 90): Promise<number> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await this.userActivityRepository
      .createQueryBuilder()
      .delete()
      .from(UserActivity)
      .where('userProfileId = :profileId', { profileId: profile.id })
      .andWhere('createdAt < :cutoffDate', { cutoffDate })
      .execute();

    return result.affected || 0;
  }

  async getActivitySummary(userId: string): Promise<any> {
    const profile = await this.userProfileRepository.findOne({ where: { userId } });
    if (!profile) {
      throw new Error('User profile not found');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);

    const thisMonth = new Date();
    thisMonth.setMonth(thisMonth.getMonth() - 1);

    const [todayActivities, weekActivities, monthActivities, totalActivities] = await Promise.all([
      this.userActivityRepository.count({
        where: {
          userProfileId: profile.id,
          createdAt: { $gte: today } as any,
        },
      }),
      this.userActivityRepository.count({
        where: {
          userProfileId: profile.id,
          createdAt: { $gte: thisWeek } as any,
        },
      }),
      this.userActivityRepository.count({
        where: {
          userProfileId: profile.id,
          createdAt: { $gte: thisMonth } as any,
        },
      }),
      this.userActivityRepository.count({
        where: { userProfileId: profile.id },
      }),
    ]);

    return {
      today: todayActivities,
      thisWeek: weekActivities,
      thisMonth: monthActivities,
      total: totalActivities,
    };
  }
}
