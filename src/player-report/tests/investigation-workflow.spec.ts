import { InvestigationService } from '../services/investigation.service';
import { PlayerReport } from '../entities/player-report.entity';

describe('Investigation Workflow', () => {
  let service: InvestigationService;
  let report: PlayerReport;

  beforeEach(() => {
    service = new InvestigationService();
    report = new PlayerReport();
    report.id = 'test-id';
    report.status = 'pending';
  });

  it('should start investigation', () => {
    service.startInvestigation(report);
    expect(report.status).toBe('investigating');
  });

  it('should resolve investigation', () => {
    service.startInvestigation(report);
    service.resolve(report, 'resolved');
    expect(report.status).toBe('resolved');
    expect(report.resolution).toBe('resolved');
  });

  it('should handle appeal', () => {
    service.startInvestigation(report);
    service.resolve(report, 'resolved');
    service.appeal(report, 'unfair');
    expect(report.status).toBe('appealed');
    expect(report.appealReason).toBe('unfair');
  });
});
