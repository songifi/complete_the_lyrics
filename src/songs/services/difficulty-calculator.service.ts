import { Injectable } from '@nestjs/common';
import { DifficultyLevel } from '../entities/song.entity';

export interface DifficultyFactors {
  bpm?: number;
  key?: string;
  timeSignature?: string;
  complexity?: number;
  rhythmComplexity?: number;
  harmonicComplexity?: number;
  melodicComplexity?: number;
  duration?: number;
  genre?: string;
}

@Injectable()
export class DifficultyCalculatorService {
  calculateDifficultyScore(factors: DifficultyFactors): number {
    let score = 0;
    let weight = 0;

    // BPM factor (faster = harder)
    if (factors.bpm) {
      const bpmScore = this.calculateBpmScore(factors.bpm);
      score += bpmScore * 0.2;
      weight += 0.2;
    }

    // Time signature complexity
    if (factors.timeSignature) {
      const timeScore = this.calculateTimeSignatureScore(factors.timeSignature);
      score += timeScore * 0.15;
      weight += 0.15;
    }

    // Musical complexity factors
    if (factors.complexity) {
      score += factors.complexity * 0.25;
      weight += 0.25;
    }

    if (factors.rhythmComplexity) {
      score += factors.rhythmComplexity * 0.2;
      weight += 0.2;
    }

    if (factors.harmonicComplexity) {
      score += factors.harmonicComplexity * 0.1;
      weight += 0.1;
    }

    if (factors.melodicComplexity) {
      score += factors.melodicComplexity * 0.1;
      weight += 0.1;
    }

    // Normalize score
    const normalizedScore = weight > 0 ? score / weight : 2.5;
    
    // Clamp between 1 and 5
    return Math.max(1, Math.min(5, normalizedScore));
  }

  getDifficultyLevel(score: number): DifficultyLevel {
    if (score <= 1.5) return DifficultyLevel.BEGINNER;
    if (score <= 2.5) return DifficultyLevel.EASY;
    if (score <= 3.5) return DifficultyLevel.INTERMEDIATE;
    if (score <= 4.5) return DifficultyLevel.ADVANCED;
    return DifficultyLevel.EXPERT;
  }

  private calculateBpmScore(bpm: number): number {
    if (bpm < 60) return 1;
    if (bpm < 90) return 2;
    if (bpm < 120) return 3;
    if (bpm < 160) return 4;
    return 5;
  }

  private calculateTimeSignatureScore(timeSignature: string): number {
    const commonSignatures = ['4/4', '2/4', '3/4'];
    const moderateSignatures = ['6/8', '2/2', '12/8'];
    const complexSignatures = ['5/4', '7/8', '9/8', '5/8'];

    if (commonSignatures.includes(timeSignature)) return 1;
    if (moderateSignatures.includes(timeSignature)) return 3;
    if (complexSignatures.includes(timeSignature)) return 4;
    return 5; // Unknown/very complex signatures
  }
}