import { Injectable } from '@nestjs/common';
import { PlayerReport } from '../entities/player-report.entity';
import { InvestigationFSM } from '../fsm/investigation-fsm';
import { AuditLogger } from '../audit/audit-logger.service';

@Injectable()
export class InvestigationService {
  startInvestigation(report: PlayerReport) {
    InvestigationFSM.startInvestigation();
    report.status = InvestigationFSM.state;
    report.investigationHistory = [ ...(report.investigationHistory || []), { action: 'startInvestigation', date: new Date() } ];
    AuditLogger.log('Investigation Started', { reportId: report.id });
  }

  resolve(report: PlayerReport, resolution: string) {
    InvestigationFSM.resolve();
    report.status = InvestigationFSM.state;
    report.resolution = resolution;
    report.investigationHistory = [ ...(report.investigationHistory || []), { action: 'resolve', date: new Date(), resolution } ];
    AuditLogger.log('Investigation Resolved', { reportId: report.id, resolution });
  }

  appeal(report: PlayerReport, reason: string) {
    InvestigationFSM.appeal();
    report.status = InvestigationFSM.state;
    report.appealReason = reason;
    report.investigationHistory = [ ...(report.investigationHistory || []), { action: 'appeal', date: new Date(), reason } ];
    AuditLogger.log('Appeal Submitted', { reportId: report.id, reason });
  }
}
