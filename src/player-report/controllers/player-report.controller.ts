import { Controller, Post, Body, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { EvidenceService } from '../services/evidence.service';
import { PlayerReport } from '../entities/player-report.entity';

@Controller('player-report')
export class PlayerReportController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @UseInterceptors(FileInterceptor('evidence'))
  async createReport(
    @Body() body: any,
    @UploadedFile() evidence: any
  ): Promise<PlayerReport> {
    const report = new PlayerReport();
    report.reporterId = body.reporterId;
    report.reportedPlayerId = body.reportedPlayerId;
    report.description = body.description;
    report.category = body.category;
    report.priority = body.priority;
    report.status = 'pending';
    if (evidence) {
      report.evidenceUrl = await this.evidenceService.uploadEvidence(evidence);
    }
    // Integrate analytics and pattern detection
    // You would fetch all reports from DB in a real app
    const allReports = [report]; // Replace with actual DB fetch
    const { AnalyticsService } = require('../services/analytics.service');
    const analyticsService = new AnalyticsService();
    await analyticsService.attachAnalytics(report, allReports);
    // Save report to DB (pseudo-code, replace with actual repository)
    // await reportRepository.save(report);
    return report;
  }
}
