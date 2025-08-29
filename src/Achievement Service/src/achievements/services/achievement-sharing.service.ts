import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAchievement } from '../entities/user-achievement.entity';
import { ShareAchievementDto } from '../dto/share-achievement.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AchievementSharingService {
  constructor(
    @InjectRepository(UserAchievement)
    private userAchievementRepository: Repository<UserAchievement>,
    private eventEmitter: EventEmitter2,
  ) {}

  async shareAchievement(
    userId: string,
    achievementId: string,
    shareDto: ShareAchievementDto,
  ) {
    const userAchievement = await this.userAchievementRepository.findOne({
      where: {
        userId,
        achievement: { id: achievementId },
        status: 'unlocked',
      },
      relations: ['achievement'],
    });

    if (!userAchievement) {
      throw new Error('Achievement not found or not unlocked');
    }

    const shareData = {
      userId,
      achievement: userAchievement.achievement,
      platform: shareDto.platform,
      message: shareDto.message,
      sharedAt: new Date(),
    };

    // Generate share content based on platform
    const shareContent = this.generateShareContent(shareData);

    // Emit sharing event for tracking
    this.eventEmitter.emit('achievement.shared', shareData);

    return {
      shareUrl: shareContent.url,
      shareText: shareContent.text,
      imageUrl: shareContent.imageUrl,
      platform: shareDto.platform,
    };
  }

  private generateShareContent(shareData: any) {
    const { achievement, platform, message, userId } = shareData;
    const baseUrl = process.env.APP_URL || 'https://yourapp.com';
    
    const defaultMessage = ` I just unlocked "${achievement.name}" achievement! ${achievement.description}`;
    const shareText = message || defaultMessage;
    
    const shareUrl = `${baseUrl}/achievements/${achievement.id}?shared=${userId}`;
    
    switch (platform) {
      case 'twitter':
        return {
          url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`,
          text: shareText,
          imageUrl: achievement.imageUrl,
        };
      
      case 'facebook':
        return {
          url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
          text: shareText,
          imageUrl: achievement.imageUrl,
        };
      
      case 'linkedin':
        return {
          url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
          text: shareText,
          imageUrl: achievement.imageUrl,
        };
      
      default:
        return {
          url: shareUrl,
          text: shareText,
          imageUrl: achievement.imageUrl,
        };
    }
  }

  async getAchievementShareStats(achievementId: string) {
    // This would typically query a shares tracking table
    // For now, we'll emit an event that can be handled by analytics
    this.eventEmitter.emit('achievement.share.stats.requested', { achievementId });
    
    return {
      totalShares: 0,
      platformBreakdown: {
        twitter: 0,
        facebook: 0,
        linkedin: 0,
        other: 0,
      },
    };
  }
}