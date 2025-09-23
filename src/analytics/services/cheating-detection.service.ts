import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRound } from '../../GameRound/entities/game-round.entity';
import { PlayerPerformance } from '../entities/player-performance.entity';
import { AnswerPattern, PatternType, PatternSeverity } from '../entities/answer-pattern.entity';

export interface CheatingIndicator {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  confidence: number;
  evidence: any;
  timestamp: Date;
}

export interface CheatingAnalysisResult {
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  indicators: CheatingIndicator[];
  recommendations: string[];
  falsePositiveProbability: number;
}

@Injectable()
export class CheatingDetectionService {
  private readonly logger = new Logger(CheatingDetectionService.name);

  constructor(
    @InjectRepository(GameRound)
    private gameRoundRepository: Repository<GameRound>,
    @InjectRepository(PlayerPerformance)
    private playerPerformanceRepository: Repository<PlayerPerformance>,
    @InjectRepository(AnswerPattern)
    private answerPatternRepository: Repository<AnswerPattern>,
  ) {}

  async analyzePlayerBehavior(
    userId: string,
    sessionId?: string,
    timeWindowHours: number = 24,
  ): Promise<CheatingAnalysisResult> {
    const indicators: CheatingIndicator[] = [];
    
    // Get recent game rounds
    const recentRounds = await this.getRecentRounds(userId, sessionId, timeWindowHours);
    
    if (recentRounds.length === 0) {
      return {
        riskScore: 0,
        riskLevel: 'LOW',
        indicators: [],
        recommendations: [],
        falsePositiveProbability: 0,
      };
    }

    // Analyze different cheating patterns
    const responseTimeIndicators = await this.analyzeResponseTimePatterns(userId, recentRounds);
    const accuracyIndicators = await this.analyzeAccuracyPatterns(userId, recentRounds);
    const behavioralIndicators = await this.analyzeBehavioralPatterns(userId, recentRounds);
    const consistencyIndicators = await this.analyzeConsistencyPatterns(userId, recentRounds);
    const patternAnomalyIndicators = await this.analyzePatternAnomalies(userId, recentRounds);

    indicators.push(
      ...responseTimeIndicators,
      ...accuracyIndicators,
      ...behavioralIndicators,
      ...consistencyIndicators,
      ...patternAnomalyIndicators,
    );

    // Calculate overall risk score
    const riskScore = this.calculateRiskScore(indicators);
    const riskLevel = this.determineRiskLevel(riskScore);
    const falsePositiveProbability = this.calculateFalsePositiveProbability(indicators);

    // Generate recommendations
    const recommendations = this.generateRecommendations(indicators, riskLevel);

    return {
      riskScore,
      riskLevel,
      indicators,
      recommendations,
      falsePositiveProbability,
    };
  }

  private async getRecentRounds(
    userId: string,
    sessionId?: string,
    timeWindowHours: number = 24,
  ): Promise<GameRound[]> {
    const timeWindow = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    
    const query = this.gameRoundRepository
      .createQueryBuilder('round')
      .leftJoinAndSelect('round.session', 'session')
      .where('round.createdAt >= :timeWindow', { timeWindow })
      .andWhere('JSON_EXTRACT(round.answers, :userId) IS NOT NULL', { userId: `$.${userId}` });

    if (sessionId) {
      query.andWhere('round.sessionId = :sessionId', { sessionId });
    }

    return await query
      .orderBy('round.createdAt', 'DESC')
      .limit(100)
      .getMany();
  }

  private async analyzeResponseTimePatterns(
    userId: string,
    rounds: GameRound[],
  ): Promise<CheatingIndicator[]> {
    const indicators: CheatingIndicator[] = [];
    const responseTimes: number[] = [];

    // Collect response times
    rounds.forEach(round => {
      const answers = Object.values(round.answers);
      answers.forEach(answer => {
        if (answer.timeElapsed > 0) {
          responseTimes.push(answer.timeElapsed);
        }
      });
    });

    if (responseTimes.length < 5) {
      return indicators;
    }

    // Calculate statistics
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];
    const stdDev = this.calculateStandardDeviation(responseTimes, avgResponseTime);

    // Detect suspiciously fast responses
    const suspiciouslyFast = responseTimes.filter(time => time < avgResponseTime * 0.2);
    if (suspiciouslyFast.length > responseTimes.length * 0.3) {
      indicators.push({
        type: 'suspicious_response_times',
        severity: 'high',
        description: `Unusually fast response times detected: ${suspiciouslyFast.length}/${responseTimes.length} responses under 20% of average`,
        confidence: Math.min(95, (suspiciouslyFast.length / responseTimes.length) * 100),
        evidence: {
          suspiciousCount: suspiciouslyFast.length,
          totalCount: responseTimes.length,
          percentage: (suspiciouslyFast.length / responseTimes.length) * 100,
          averageTime: avgResponseTime,
          suspiciousTimes: suspiciouslyFast.slice(0, 10), // Sample for evidence
        },
        timestamp: new Date(),
      });
    }

    // Detect impossible response times (less than 500ms for complex questions)
    const impossibleTimes = responseTimes.filter(time => time < 500);
    if (impossibleTimes.length > 0) {
      indicators.push({
        type: 'impossible_response_times',
        severity: 'critical',
        description: `Impossibly fast response times detected: ${impossibleTimes.length} responses under 500ms`,
        confidence: 99,
        evidence: {
          impossibleCount: impossibleTimes.length,
          impossibleTimes: impossibleTimes,
        },
        timestamp: new Date(),
      });
    }

    // Detect consistent response times (bot-like behavior)
    const timeVariance = this.calculateVariance(responseTimes);
    const coefficientOfVariation = stdDev / avgResponseTime;
    
    if (coefficientOfVariation < 0.1 && responseTimes.length > 10) {
      indicators.push({
        type: 'bot_like_consistency',
        severity: 'medium',
        description: 'Response times show suspicious consistency, suggesting automated behavior',
        confidence: 75,
        evidence: {
          coefficientOfVariation,
          averageTime: avgResponseTime,
          standardDeviation: stdDev,
        },
        timestamp: new Date(),
      });
    }

    return indicators;
  }

  private async analyzeAccuracyPatterns(
    userId: string,
    rounds: GameRound[],
  ): Promise<CheatingIndicator[]> {
    const indicators: CheatingIndicator[] = [];
    const accuracyRates: number[] = [];

    // Calculate accuracy for each round
    rounds.forEach(round => {
      const answers = Object.values(round.answers);
      if (answers.length > 0) {
        const correctAnswers = answers.filter(answer => answer.isCorrect).length;
        accuracyRates.push(correctAnswers / answers.length);
      }
    });

    if (accuracyRates.length < 3) {
      return indicators;
    }

    const avgAccuracy = accuracyRates.reduce((a, b) => a + b, 0) / accuracyRates.length;

    // Detect suspiciously high accuracy
    if (avgAccuracy > 0.95 && accuracyRates.length > 5) {
      indicators.push({
        type: 'suspicious_accuracy',
        severity: 'high',
        description: `Unusually high accuracy rate: ${(avgAccuracy * 100).toFixed(1)}%`,
        confidence: Math.min(90, avgAccuracy * 100),
        evidence: {
          averageAccuracy: avgAccuracy,
          roundCount: accuracyRates.length,
          accuracyRates: accuracyRates.slice(0, 10), // Sample for evidence
        },
        timestamp: new Date(),
      });
    }

    // Detect perfect accuracy streaks
    const perfectRounds = accuracyRates.filter(rate => rate === 1.0).length;
    if (perfectRounds > accuracyRates.length * 0.7) {
      indicators.push({
        type: 'perfect_accuracy_streak',
        severity: 'critical',
        description: `Suspicious perfect accuracy streak: ${perfectRounds}/${accuracyRates.length} rounds with 100% accuracy`,
        confidence: 95,
        evidence: {
          perfectRounds,
          totalRounds: accuracyRates.length,
          percentage: (perfectRounds / accuracyRates.length) * 100,
        },
        timestamp: new Date(),
      });
    }

    return indicators;
  }

  private async analyzeBehavioralPatterns(
    userId: string,
    rounds: GameRound[],
  ): Promise<CheatingIndicator[]> {
    const indicators: CheatingIndicator[] = [];

    // Analyze answer patterns
    const answerPatterns = this.extractAnswerPatterns(rounds);
    
    // Detect repetitive patterns (same answers in sequence)
    const repetitivePatterns = this.detectRepetitivePatterns(answerPatterns);
    if (repetitivePatterns.length > 0) {
      indicators.push({
        type: 'repetitive_answer_patterns',
        severity: 'medium',
        description: 'Detected repetitive answer patterns suggesting automated responses',
        confidence: 70,
        evidence: {
          patterns: repetitivePatterns,
          patternCount: repetitivePatterns.length,
        },
        timestamp: new Date(),
      });
    }

    // Detect answer timing patterns
    const timingPatterns = this.analyzeAnswerTimingPatterns(rounds);
    if (timingPatterns.suspicious) {
      indicators.push({
        type: 'suspicious_timing_patterns',
        severity: 'high',
        description: 'Detected suspicious timing patterns in answers',
        confidence: 80,
        evidence: timingPatterns,
        timestamp: new Date(),
      });
    }

    return indicators;
  }

  private async analyzeConsistencyPatterns(
    userId: string,
    rounds: GameRound[],
  ): Promise<CheatingIndicator[]> {
    const indicators: CheatingIndicator[] = [];

    // Get player's historical performance
    const performance = await this.playerPerformanceRepository.findOne({
      where: { userId },
    });

    if (!performance) {
      return indicators;
    }

    // Compare current session with historical performance
    const currentAccuracy = this.calculateCurrentAccuracy(rounds);
    const historicalAccuracy = performance.accuracyRate;

    // Detect sudden performance improvement
    if (currentAccuracy > historicalAccuracy * 1.5 && currentAccuracy > 0.8) {
      indicators.push({
        type: 'sudden_performance_improvement',
        severity: 'medium',
        description: `Sudden performance improvement detected: ${(currentAccuracy * 100).toFixed(1)}% vs historical ${(historicalAccuracy * 100).toFixed(1)}%`,
        confidence: 65,
        evidence: {
          currentAccuracy,
          historicalAccuracy,
          improvement: ((currentAccuracy - historicalAccuracy) / historicalAccuracy) * 100,
        },
        timestamp: new Date(),
      });
    }

    // Detect inconsistent performance levels
    const performanceVariance = this.calculatePerformanceVariance(rounds);
    if (performanceVariance > 0.3) {
      indicators.push({
        type: 'inconsistent_performance',
        severity: 'low',
        description: 'High variance in performance levels detected',
        confidence: 60,
        evidence: {
          variance: performanceVariance,
          rounds: rounds.length,
        },
        timestamp: new Date(),
      });
    }

    return indicators;
  }

  private async analyzePatternAnomalies(
    userId: string,
    rounds: GameRound[],
  ): Promise<CheatingIndicator[]> {
    const indicators: CheatingIndicator[] = [];

    // Check for existing cheating patterns
    const existingPatterns = await this.answerPatternRepository.find({
      where: {
        userId,
        patternType: PatternType.CHEATING_SUSPICION,
        isActive: true,
      },
      order: { createdAt: 'DESC' },
      take: 10,
    });

    // Detect pattern escalation
    const recentPatterns = existingPatterns.filter(
      pattern => pattern.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    );

    if (recentPatterns.length > 3) {
      indicators.push({
        type: 'pattern_escalation',
        severity: 'high',
        description: `Multiple cheating patterns detected in recent sessions: ${recentPatterns.length} patterns in 7 days`,
        confidence: 85,
        evidence: {
          patternCount: recentPatterns.length,
          timeWindow: '7 days',
          patterns: recentPatterns.map(p => ({
            type: p.patternType,
            severity: p.severity,
            createdAt: p.createdAt,
          })),
        },
        timestamp: new Date(),
      });
    }

    return indicators;
  }

  private calculateRiskScore(indicators: CheatingIndicator[]): number {
    let riskScore = 0;

    indicators.forEach(indicator => {
      const baseScore = this.getSeverityScore(indicator.severity);
      const confidenceMultiplier = indicator.confidence / 100;
      riskScore += baseScore * confidenceMultiplier;
    });

    return Math.min(100, Math.round(riskScore));
  }

  private getSeverityScore(severity: string): number {
    switch (severity) {
      case 'critical': return 40;
      case 'high': return 25;
      case 'medium': return 15;
      case 'low': return 5;
      default: return 0;
    }
  }

  private determineRiskLevel(riskScore: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (riskScore >= 80) return 'CRITICAL';
    if (riskScore >= 60) return 'HIGH';
    if (riskScore >= 30) return 'MEDIUM';
    return 'LOW';
  }

  private calculateFalsePositiveProbability(indicators: CheatingIndicator[]): number {
    // Simple heuristic - in production, this would be more sophisticated
    const criticalCount = indicators.filter(i => i.severity === 'critical').length;
    const highCount = indicators.filter(i => i.severity === 'high').length;
    
    if (criticalCount > 0) return 5; // 5% false positive for critical
    if (highCount > 2) return 15; // 15% false positive for multiple high severity
    if (highCount > 0) return 25; // 25% false positive for single high severity
    
    return 40; // 40% false positive for medium/low severity
  }

  private generateRecommendations(
    indicators: CheatingIndicator[],
    riskLevel: string,
  ): string[] {
    const recommendations: string[] = [];

    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      recommendations.push('Immediately flag session for manual review');
      recommendations.push('Consider temporary account suspension pending investigation');
    }

    if (indicators.some(i => i.type === 'suspicious_response_times')) {
      recommendations.push('Implement response time validation with minimum thresholds');
      recommendations.push('Add random delays to prevent automated responses');
    }

    if (indicators.some(i => i.type === 'suspicious_accuracy')) {
      recommendations.push('Introduce random difficulty spikes to verify genuine knowledge');
      recommendations.push('Add CAPTCHA challenges for high-accuracy sessions');
    }

    if (indicators.some(i => i.type === 'bot_like_consistency')) {
      recommendations.push('Implement behavioral analysis to detect non-human patterns');
      recommendations.push('Add mouse movement and interaction tracking');
    }

    recommendations.push('Monitor player for continued suspicious activity');
    recommendations.push('Consider implementing additional verification steps');

    return recommendations;
  }

  // Helper methods
  private calculateStandardDeviation(values: number[], mean: number): number {
    const variance = this.calculateVariance(values, mean);
    return Math.sqrt(variance);
  }

  private calculateVariance(values: number[], mean?: number): number {
    const resolvedMean = mean !== undefined
      ? mean
      : values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((acc, val) => acc + Math.pow(val - resolvedMean, 2), 0) / values.length;
  }

  private extractAnswerPatterns(rounds: GameRound[]): any[] {
    const patterns = [];
    
    rounds.forEach(round => {
      const answers = Object.values(round.answers);
      answers.forEach(answer => {
        patterns.push({
          answer: answer.answer,
          isCorrect: answer.isCorrect,
          timeElapsed: answer.timeElapsed,
          submittedAt: answer.submittedAt,
        });
      });
    });

    return patterns;
  }

  private detectRepetitivePatterns(patterns: any[]): any[] {
    const repetitivePatterns = [];
    const patternLength = 3; // Look for 3-answer patterns

    for (let i = 0; i <= patterns.length - patternLength; i++) {
      const currentPattern = patterns.slice(i, i + patternLength);
      const isRepetitive = this.isPatternRepetitive(currentPattern);
      
      if (isRepetitive) {
        repetitivePatterns.push({
          pattern: currentPattern,
          startIndex: i,
        });
      }
    }

    return repetitivePatterns;
  }

  private isPatternRepetitive(pattern: any[]): boolean {
    // Check if all answers are identical
    const firstAnswer = pattern[0].answer;
    return pattern.every(p => p.answer === firstAnswer);
  }

  private analyzeAnswerTimingPatterns(rounds: GameRound[]): any {
    const timingData = [];
    
    rounds.forEach(round => {
      const answers = Object.values(round.answers);
      answers.forEach(answer => {
        timingData.push({
          timeElapsed: answer.timeElapsed,
          submittedAt: answer.submittedAt,
        });
      });
    });

    // Check for suspicious timing patterns
    const intervals = [];
    for (let i = 1; i < timingData.length; i++) {
      const interval = timingData[i].submittedAt.getTime() - timingData[i - 1].submittedAt.getTime();
      intervals.push(interval);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const suspiciousIntervals = intervals.filter(interval => 
      Math.abs(interval - avgInterval) < 1000 // Within 1 second of average
    );

    return {
      suspicious: suspiciousIntervals.length > intervals.length * 0.7,
      averageInterval: avgInterval,
      suspiciousCount: suspiciousIntervals.length,
      totalCount: intervals.length,
    };
  }

  private calculateCurrentAccuracy(rounds: GameRound[]): number {
    let totalAnswers = 0;
    let correctAnswers = 0;

    rounds.forEach(round => {
      const answers = Object.values(round.answers);
      totalAnswers += answers.length;
      correctAnswers += answers.filter(answer => answer.isCorrect).length;
    });

    return totalAnswers > 0 ? correctAnswers / totalAnswers : 0;
  }

  private calculatePerformanceVariance(rounds: GameRound[]): number {
    const accuracyRates = rounds.map(round => {
      const answers = Object.values(round.answers);
      if (answers.length === 0) return 0;
      return answers.filter(answer => answer.isCorrect).length / answers.length;
    });

    if (accuracyRates.length < 2) return 0;

    const mean = accuracyRates.reduce((a, b) => a + b, 0) / accuracyRates.length;
    const variance = accuracyRates.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / accuracyRates.length;
    
    return Math.sqrt(variance);
  }
}
