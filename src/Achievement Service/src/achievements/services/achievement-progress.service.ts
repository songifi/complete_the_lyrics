import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AchievementProgress } from '../entities/achievement-progress.entity';
import { Achievement } from '../entities/achievement.entity';
import { UserAchievement } from '../entities/user-achievement.entity';
import { UpdateProgressDto } from '../dto/update-progress.dto';
import { AchievementsService } from '../achievements.service';

@Injectable()
export class AchievementProgressService {
  constructor(
    @InjectRepository(AchievementProgress)
    private progressRepository: Repository<AchievementProgress>,
    @InjectRepository(Achievement)
    private achievementRepository: Repository<Achievement>,
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    private eventEmitter: EventEmitter2,
  ) {}

  async updateProgress(userId: string, dto: UpdateProgressDto) {
    const { action, category, value = 1 } = dto;

    // Find relevant achievements
    const achievements = await this.achievementRepository.find({
      where: {
        triggerAction: action,
        category: category || undefined,
        isActive: true,
      },
    });

    const updatedAchievements = [];

    for (const achievement of achievements) {
      const progress = await this.getOrCreateProgress(userId, achievement.id);
      const oldValue = progress.currentValue;
      
      // Update progress based on achievement type
      switch (achievement.type) {
        case 'cumulative':
          progress.currentValue += value;
          break;
        case 'milestone':
          progress.currentValue = Math.max(progress.currentValue, value);
          break;
        case 'streak':
          // Handle streak logic
          const today = new Date().toDateString();
          const lastUpdate = progress.lastUpdated?.toDateString();
          
          if (lastUpdate === today) {
            // Already updated today, continue streak
            continue;
          } else if (this.isConsecutiveDay(progress.lastUpdated)) {
            progress.currentValue += 1;
          } else {
            progress.currentValue = 1; // Reset streak
          }
          break;
        default:
          progress.currentValue = value;
      }

      progress.lastUpdated = new Date();
      await this.progressRepository.save(progress);

      // Check if achievement should be unlocked
      if (progress.currentValue >= achievement.targetValue) {
        const userAchievement = await this.userAchievementRepository.findOne({
          where: { userId, achievement: { id: achievement.id } },
        });

        if (!userAchievement || userAchievement.status !== 'unlocked') {
          // Unlock achievement
          this.eventEmitter.emit('achievement.unlock', {
            userId,
            achievementId: achievement.id,
          });
          
          updatedAchievements.push({
            achievement,
            oldProgress: oldValue,
            newProgress: progress.currentValue,
            unlocked: true,
          });
        }
      } else {
        updatedAchievements.push({
          achievement,
          oldProgress: oldValue,
          newProgress: progress.currentValue,
          unlocked: false,
        });
      }
    }

    return {
      message: 'Progress updated successfully',
      updatedAchievements,
    };
  }

  async getUserProgress(userId: string) {
    const progress = await this.progressRepository.find({
      where: { userId },
      relations: ['achievement'],
      order: { lastUpdated: 'DESC' },
    });

    return progress.map((p) => ({
      achievement: p.achievement,
      currentValue: p.currentValue,
      targetValue: p.achievement.targetValue,
      percentage: Math.min((p.currentValue / p.achievement.targetValue) * 100, 100),
      lastUpdated: p.lastUpdated,
    }));
  }

  private async getOrCreateProgress(userId: string, achievementId: string) {
    let progress = await this.progressRepository.findOne({
      where: { userId, achievement: { id: achievementId } },
    });

    if (!progress) {
      const achievement = await this.achievementRepository.findOne({
        where: { id: achievementId },
      });

      progress = this.progressRepository.create({
        userId,
        achievement,
        currentValue: 0,
      });
    }

    return progress;
  }

  private isConsecutiveDay(lastUpdated: Date): boolean {
    if (!lastUpdated) return false;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    return lastUpdated.toDateString() === yesterday.toDateString();
  }

  // Method to be called from other services to trigger progress updates
  async trackAction(userId: string, action: string, category?: string, value?: number) {
    return this.updateProgress(userId, { action, category, value });
  }
}