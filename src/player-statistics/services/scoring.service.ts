import { Injectable } from '@nestjs/common';
import { PlayerStats } from '../entities/player-stats.entity';

export interface ScoringWeights {
  combat: {
    kills: number;
    deaths: number;
    accuracy: number;
    damageDealt: number;
  };
  exploration: {
    itemsCollected: number;
    questsCompleted: number;
    timePlayedMinutes: number;
  };
  social: {
    socialInteractions: number;
  };
  achievement: {
    experience: number;
    level: number;
  };
}

@Injectable()
export class ScoringService {
  private readonly defaultWeights: ScoringWeights = {
    combat: {
      kills: 10,
      deaths: -5,
      accuracy: 2,
      damageDealt: 0.1
    },
    exploration: {
      itemsCollected: 5,
      questsComplected: 25,
      timePlayedMinutes: 0.5
    },
    social: {
      socialInteractions: 3
    },
    achievement: {
      experience: 0.01,
      level: 100
    }
  };

  calculateScore(stats: PlayerStats, customWeights?: Partial<ScoringWeights>): number {
    const weights = { ...this.defaultWeights, ...customWeights };
    const { category, metrics } = stats;
    
    let score = 0;

    switch (category) {
      case 'combat':
        score += (metrics.kills || 0) * weights.combat.kills;
        score += (metrics.deaths || 0) * weights.combat.deaths;
        score += (metrics.accuracy || 0) * weights.combat.accuracy;
        score += (metrics.damageDealt || 0) * weights.combat.damageDealt;
        break;

      case 'exploration':
        score += (metrics.itemsCollected || 0) * weights.exploration.itemsCollected;
        score += (metrics.questsCompleted || 0) * weights.exploration.questsComplected;
        score += (metrics.timePlayedMinutes || 0) * weights.exploration.timePlayedMinutes;
        break;

      case 'social':
        score += (metrics.socialInteractions || 0) * weights.social.socialInteractions;
        break;

      case 'achievement':
        score += (metrics.experience || 0) * weights.achievement.experience;
        score += (metrics.level || 0) * weights.achievement.level;
        break;
    }

    // Apply multipliers based on metadata
    if (stats.metadata?.difficulty) {
      const difficultyMultipliers = {
        easy: 0.8,
        normal: 1.0,
        hard: 1.3,
        expert: 1.6
      };
      score *= difficultyMultipliers[stats.metadata.difficulty] || 1.0;
    }

    return Math.max(0, Math.round(score * 100) / 100);
  }

  calculateOverallScore(playerStats: PlayerStats[]): number {
    const categoryScores = new Map<string, number>();
    
    playerStats.forEach(stats => {
      const category = stats.category;
      const currentScore = categoryScores.get(category) || 0;
      categoryScores.set(category, currentScore + stats.calculatedScore);
    });

    const categoryWeights = {
      combat: 0.3,
      exploration: 0.25,
      social: 0.15,
      achievement: 0.3
    };

    let overallScore = 0;
    categoryScores.forEach((score, category) => {
      overallScore += score * (categoryWeights[category] || 0.1);
    });

    return Math.round(overallScore * 100) / 100;
  }
}
