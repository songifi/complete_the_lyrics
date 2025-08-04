import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { InvestigationService } from '../services/investigation.service';
import { AdminGuard } from '../admin/admin.guard';

@Controller('investigation')
@UseGuards(AdminGuard)
export class InvestigationController {
  constructor(private readonly investigationService: InvestigationService) {}

  @Post(':id/start')
  start(@Param('id') id: string, @Body() report: any) {
    return this.investigationService.startInvestigation(report);
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body('resolution') resolution: string, @Body() report: any) {
    return this.investigationService.resolve(report, resolution);
  }

  @Post(':id/appeal')
  appeal(@Param('id') id: string, @Body('reason') reason: string, @Body() report: any) {
    return this.investigationService.appeal(report, reason);
  }
}
