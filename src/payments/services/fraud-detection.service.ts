import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { Transaction, TransactionStatus } from '../entities/transaction.entity';
import { AuditService } from './audit.service';

export interface FraudAnalysisRequest {
  amount: number;
  currency: string;
  userId: string;
  customerId: string;
  ipAddress?: string;
  userAgent?: string;
  deviceFingerprint?: string;
  billingAddress?: any;
  shippingAddress?: any;
}

export interface FraudScore {
  score: number; // 0-100, higher is more suspicious
  riskLevel: 'low' | 'medium' | 'high';
  factors: string[];
  recommendations: string[];
}

@Injectable()
export class FraudDetectionService {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
    private readonly auditService: AuditService,
  ) {}

  async analyzePayment(request: FraudAnalysisRequest): Promise<FraudScore> {
    const factors: string[] = [];
    let score = 0;
    const recommendations: string[] = [];

    try {
      // Check velocity (frequency of transactions)
      const velocityScore = await this.checkVelocity(
        request.userId,
        request.customerId,
      );
      score += velocityScore.score;
      factors.push(...velocityScore.factors);

      // Check amount patterns
      const amountScore = await this.checkAmountPatterns(
        request.amount,
        request.userId,
      );
      score += amountScore.score;
      factors.push(...amountScore.factors);

      // Check geographic patterns (if IP address provided)
      if (request.ipAddress) {
        const geoScore = await this.checkGeographicPatterns(
          request.ipAddress,
          request.userId,
        );
        score += geoScore.score;
        factors.push(...geoScore.factors);
      }

      // Check device patterns (if device fingerprint provided)
      if (request.deviceFingerprint) {
        const deviceScore = await this.checkDevicePatterns(
          request.deviceFingerprint,
          request.userId,
        );
        score += deviceScore.score;
        factors.push(...deviceScore.factors);
      }

      // Check for known fraud patterns
      const patternScore = await this.checkFraudPatterns(request);
      score += patternScore.score;
      factors.push(...patternScore.factors);

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high';
      if (score >= 70) {
        riskLevel = 'high';
        recommendations.push('Block transaction and require manual review');
        recommendations.push('Implement additional verification steps');
      } else if (score >= 40) {
        riskLevel = 'medium';
        recommendations.push(
          'Require additional verification (3D Secure, SMS, etc.)',
        );
        recommendations.push('Monitor closely for patterns');
      } else {
        riskLevel = 'low';
        recommendations.push('Process normally with standard monitoring');
      }

      const fraudScore: FraudScore = {
        score: Math.min(100, Math.max(0, score)),
        riskLevel,
        factors: [...new Set(factors)], // Remove duplicates
        recommendations,
      };

      // Log fraud analysis
      await this.auditService.logFraudEvent({
        userId: request.userId,
        action: 'fraud_analysis_completed',
        fraudScore: fraudScore.score,
        riskLevel: fraudScore.riskLevel,
        factors: fraudScore.factors,
        blocked: riskLevel === 'high',
        details: {
          amount: request.amount,
          currency: request.currency,
          customerId: request.customerId,
        },
      });

      this.logger.log(
        `Fraud analysis completed for user ${request.userId}: ${fraudScore.score} (${riskLevel})`,
      );
      return fraudScore;
    } catch (error) {
      this.logger.error(`Fraud analysis failed: ${error.message}`);

      // Return conservative score on error
      return {
        score: 50,
        riskLevel: 'medium',
        factors: ['analysis_error'],
        recommendations: ['Manual review recommended due to analysis error'],
      };
    }
  }

  private async checkVelocity(
    userId: string,
    customerId: string,
  ): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    const cacheKey = `fraud_velocity_${userId}`;
    const cached = await this.cacheManager.get<any>(cacheKey);

    // Count transactions in last hour, day, and week
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [hourlyCount, dailyCount, weeklyCount] = await Promise.all([
      this.transactionRepository.count({
        where: {
          customerId,
          createdAt: new Date(oneHourAgo.getTime()),
        },
      }),
      this.transactionRepository.count({
        where: {
          customerId,
          createdAt: new Date(oneDayAgo.getTime()),
        },
      }),
      this.transactionRepository.count({
        where: {
          customerId,
          createdAt: new Date(oneWeekAgo.getTime()),
        },
      }),
    ]);

    // Score based on velocity
    if (hourlyCount > 10) {
      score += 30;
      factors.push('high_hourly_velocity');
    } else if (hourlyCount > 5) {
      score += 15;
      factors.push('medium_hourly_velocity');
    }

    if (dailyCount > 50) {
      score += 25;
      factors.push('high_daily_velocity');
    } else if (dailyCount > 20) {
      score += 10;
      factors.push('medium_daily_velocity');
    }

    if (weeklyCount > 200) {
      score += 20;
      factors.push('high_weekly_velocity');
    }

    // Cache the counts for efficiency
    await this.cacheManager.set(
      cacheKey,
      { hourlyCount, dailyCount, weeklyCount },
      300,
    ); // 5 minutes

    return { score, factors };
  }

  private async checkAmountPatterns(
    amount: number,
    userId: string,
  ): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Check for unusually high amounts
    if (amount > 10000) {
      score += 25;
      factors.push('high_amount');
    } else if (amount > 5000) {
      score += 10;
      factors.push('medium_high_amount');
    }

    // Check for round numbers (often suspicious)
    if (amount % 100 === 0 && amount >= 1000) {
      score += 5;
      factors.push('round_amount');
    }

    // Get user's historical average
    const avgResult = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoin('transaction.customer', 'customer')
      .where('customer.userId = :userId', { userId })
      .andWhere('transaction.status = :status', {
        status: TransactionStatus.SUCCEEDED,
      })
      .select('AVG(transaction.amount)', 'avg')
      .getRawOne();

    const userAverage = parseFloat(avgResult?.avg || '0');

    if (userAverage > 0) {
      const ratio = amount / userAverage;
      if (ratio > 10) {
        score += 20;
        factors.push('amount_significantly_higher_than_average');
      } else if (ratio > 5) {
        score += 10;
        factors.push('amount_higher_than_average');
      }
    }

    return { score, factors };
  }

  private async checkGeographicPatterns(
    ipAddress: string,
    userId: string,
  ): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // In a real implementation, you would:
    // 1. Get geolocation from IP address using a service like MaxMind
    // 2. Compare with user's historical locations
    // 3. Check against known VPN/proxy services
    // 4. Check against high-risk countries

    // Mock implementation
    const isVPN = await this.checkIfVPN(ipAddress);
    if (isVPN) {
      score += 20;
      factors.push('vpn_or_proxy');
    }

    const isHighRiskCountry = await this.checkHighRiskCountry(ipAddress);
    if (isHighRiskCountry) {
      score += 15;
      factors.push('high_risk_country');
    }

    return { score, factors };
  }

  private async checkDevicePatterns(
    deviceFingerprint: string,
    userId: string,
  ): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Check if device has been used by multiple users (account sharing/fraud)
    const deviceUsageCount = await this.cacheManager.get(
      `device_usage_${deviceFingerprint}`,
    );
    if (deviceUsageCount && deviceUsageCount > 5) {
      score += 25;
      factors.push('device_shared_by_multiple_users');
    }

    // Check if it's a new device for this user
    const userDevices =
      (await this.cacheManager.get(`user_devices_${userId}`)) || [];
    if (!userDevices.includes(deviceFingerprint)) {
      score += 10;
      factors.push('new_device');

      // Add device to user's device list
      userDevices.push(deviceFingerprint);
      await this.cacheManager.set(`user_devices_${userId}`, userDevices, 86400); // 24 hours
    }

    return { score, factors };
  }

  private async checkFraudPatterns(
    request: FraudAnalysisRequest,
  ): Promise<{ score: number; factors: string[] }> {
    const factors: string[] = [];
    let score = 0;

    // Check for testing patterns (common fraud behavior)
    if (request.amount === 1.0 || request.amount === 0.01) {
      score += 15;
      factors.push('testing_amount');
    }

    // Check for rapid successive transactions with small amounts
    const recentSmallTransactions = await this.transactionRepository.count({
      where: {
        customerId: request.customerId,
        amount: 5, // Less than $5
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // Last 30 minutes
      },
    });

    if (recentSmallTransactions > 3) {
      score += 20;
      factors.push('multiple_small_transactions');
    }

    return { score, factors };
  }

  private async checkIfVPN(ipAddress: string): Promise<boolean> {
    // Mock implementation - in production, use a VPN detection service
    const vpnPatterns = ['10.', '192.168.', '172.16.'];
    return vpnPatterns.some((pattern) => ipAddress.startsWith(pattern));
  }

  private async checkHighRiskCountry(ipAddress: string): Promise<boolean> {
    // Mock implementation - in production, use geolocation service
    // and maintain a list of high-risk countries
    return false;
  }

  async reportFraud(
    transactionId: string,
    reportedBy: string,
    reason: string,
  ): Promise<void> {
    await this.auditService.logFraudEvent({
      transactionId,
      userId: reportedBy,
      action: 'fraud_reported',
      fraudScore: 100,
      riskLevel: 'high',
      factors: ['manual_report'],
      blocked: true,
      details: {
        reason,
        reportedBy,
      },
    });

    this.logger.warn(
      `Fraud reported for transaction ${transactionId}: ${reason}`,
    );
  }
}
