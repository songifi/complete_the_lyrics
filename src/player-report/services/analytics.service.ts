import { Injectable } from '@nestjs/common';
import { PlayerReport } from '../entities/player-report.entity';
import * as tf from '@tensorflow/tfjs';

@Injectable()
export class AnalyticsService {
  // Dummy ML pattern detection for demonstration
  async detectPatterns(reports: PlayerReport[]): Promise<any> {
    // Example: Detect frequent abuse reports
    const abuseReports = reports.filter(r => r.category === 'abuse');
    const abuseCount = abuseReports.length;
    // ML logic placeholder
    // You could use tfjs to train or run a model here
    return {
      abuseCount,
      flagged: abuseCount > 5,
      flaggedReports: abuseReports.map(r => r.id)
    };
  }

  // Attach analytics to a report
  async attachAnalytics(report: PlayerReport, allReports: PlayerReport[]): Promise<void> {
    const analytics = await this.detectPatterns(allReports);
    report.analytics = analytics;
  }
}
