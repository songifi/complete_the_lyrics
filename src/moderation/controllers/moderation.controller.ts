import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ModerationService } from '../services/moderation.service';
import { CreateModerationCaseDto } from '../dto/create-moderation-case.dto';
import { ModerationCase } from '../entities/moderation-case.entity';
import { EscalationLevel } from '../../common/enums/escalation-level.enum';
import { ContentAnalysis } from '../../common/decorators/content-analysis.decorator';

@Controller('moderation')
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  @Post('submit')
  @ContentAnalysis({ enableTextAnalysis: true, enableImageAnalysis: true })
  async submitContent(
    @Body() dto: CreateModerationCaseDto,
  ): Promise<ModerationCase> {
    return this.moderationService.submitForModeration(dto);
  }

  @Get('queue')
  async getManualReviewQueue(
    @Query('escalationLevel') escalationLevel?: EscalationLevel,
  ): Promise<ModerationCase[]> {
    return this.moderationService.getManualReviewQueue(escalationLevel);
  }

  @Put(':id/approve')
  async approveCase(
    @Param('id') caseId: string,
    @Body('moderatorId') moderatorId: string,
    @Body('reason') reason?: string,
  ): Promise<void> {
    return this.moderationService.manualApprove(caseId, moderatorId, reason);
  }

  @Put(':id/reject')
  async rejectCase(
    @Param('id') caseId: string,
    @Body('moderatorId') moderatorId: string,
    @Body('reason') reason: string,
  ): Promise<void> {
    return this.moderationService.manualReject(caseId, moderatorId, reason);
  }
}
