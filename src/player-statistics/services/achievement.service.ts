import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement, AchievementType, AchievementRarity } from '../entities/achievement.entity';
import { PlayerStats } from '../entities/player-stats.entity';

export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  type: AchievementType;
  rarity: AchievementRarity;
  points: number;
  criteria: {
    requiredValue: number;
    requiredMetric: string;
    category?: string;
    timeframe?: string;
    comparison?: 'gte' | 'lte' | 'eq';
  };
}

@Injectable()
export class AchievementService {
  private readonly achievementDefinitions: AchievementDefinition[] = [
    {
      id: 'first_kill',
      name: 'First Blood',
      description: 'Get your first kill',
      type: AchievementType.COMBAT,
      rarity: AchievementRarity.COMMON,
      points: 10,
      criteria: {
        requiredValue: 1,
        requiredMetric: 'kills',
        category: 'combat',
        comparison: 'gte'
      }
    },
    {
      id: 'kill_streak_10',
      name: 'Unstoppable',
      description: 'Get 10 kills in a single session',
      type: AchievementType.COMBAT,
      rarity: AchievementRarity.UNCOMMON,
      points: 50,
      criteria: {
        requiredValue: 10,
        requiredMetric: 'kills',
        category: 'combat',
        comparison: 'gte'
      }
    },
    {
      id: 'explorer',
      name: 'Great Explorer',
      description: 'Collect 100 items',
      type: AchievementType.EXPLORATION,
      rarity: AchievementRarity.RARE,
      points: 100,
      criteria: {
        requiredValue: 100,
        requiredMetric: 'itemsCollected',
        category: 'exploration',
        comparison: 'gte'
      }
    },
    {
      id: 'social_butterfly',
      name: 'Social Butterfly',
      description: 'Have 50 social interactions',
      type: AchievementType.SOCIAL,
      rarity: AchievementRarity.UNCOMMON,
      points: 75,
      criteria: {
        requiredValue: 50,
        requiredMetric: 'socialInteractions',
        category: 'social',
        comparison: 'gte'
      }
    },
    {
      id: 'level_50',
      name: 'Veteran',
      description: 'Reach level 50',
      type: AchievementType.MILESTONE,
      rarity: AchievementRarity.EPIC,
      points: 200,
      criteria: {
        requiredValue: 50,
        requiredMetric: 'level',
        category: 'achievement',
        comparison: 'gte'
      }
    }
  ];

  constructor(
    @InjectRepository(Achievement)
    private readonly achievementRepository: Repository<Achievement>
  ) {}

  async checkAndUnlockAchievements(playerId: string, stats: PlayerStats[]): Promise<Achievement[]> {
    const unlockedAchievements: Achievement[] = [];
    
    // Get already unlocked achievements for this player
    const existingAchievements = await this.achievementRepository.find({
      where: { playerId, isUnlocked: true }
    });
    const unlockedIds = new Set(existingAchievements.map(a => a.achievementId));

    // Check each achievement definition
    for (const definition of this.achievementDefinitions) {
      if (unlockedIds.has(definition.id)) continue;

      const isUnlocked = this.checkAchievementCriteria(definition, stats);
      
      if (isUnlocked) {
        const achievement = this.achievementRepository.create({
          playerId,
          achievementId: definition.id,
          name: definition.name,
          description: definition.description,
          type: definition.type,
          rarity: definition.rarity,
          points: definition.points,
          criteria: definition.criteria,
          isUnlocked: true,
          unlockedAt: new Date()
        });

        const saved = await this.achievementRepository.save(achievement);
        unlockedAchievements.push(saved);
      }
    }

    return unlockedAchievements;
  }

  private checkAchievementCriteria(definition: AchievementDefinition, stats: PlayerStats[]): boolean {
    const { criteria } = definition;
    let relevantStats = stats;

    // Filter by category if specified
    if (criteria.category) {
      relevantStats = stats.filter(s => s.category === criteria.category);
    }

    // Aggregate the required metric
    let totalValue = 0;
    for (const stat of relevantStats) {
      const metricValue = stat.metrics[criteria.requiredMetric];
      if (typeof metricValue === 'number') {
        totalValue += metricValue;
      }
    }

    // Check criteria
    switch (criteria.comparison || 'gte') {
      case 'gte':
        return totalValue >= criteria.requiredValue;
      case 'lte':
        return totalValue <= criteria.requiredValue;
      case 'eq':
        return totalValue === criteria.requiredValue;
      default:
        return false;
    }
  }

  async getPlayerAchievements(playerId: string): Promise<Achievement[]> {
    return this.achievementRepository.find({
      where: { playerId, isUnlocked: true },
      order: { unlockedAt: 'DESC' }
    });
  }

  async getAchievementProgress(playerId: string, stats: PlayerStats[]): Promise<any[]> {
    const unlockedIds = new Set(
      (await this.getPlayerAchievements(playerId)).map(a => a.achievementId)
    );

    return this.achievementDefinitions.map(definition => {
      const isUnlocked = unlockedIds.has(definition.id);
      let progress = 0;

      if (!isUnlocked) {
        // Calculate progress
        const { criteria } = definition;
        let relevantStats = stats;

        if (criteria.category) {
          relevantStats = stats.filter(s => s.category === criteria.category);
        }

        let currentValue = 0;
        for (const stat of relevantStats) {
          const metricValue = stat.metrics[criteria.requiredMetric];
          if (typeof metricValue === 'number') {
            currentValue += metricValue;
          }
        }

        progress = Math.min(100, (currentValue / criteria.requiredValue) * 100);
      } else {
        progress = 100;
      }

      return {
        ...definition,
        isUnlocked,
        progress: Math.round(progress)
      };
    });
  }
}
