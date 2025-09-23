import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';import { AnswerAnalyticsService } from '../services/answer-analytics.service';
import { JwtAccessGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import {
  CreatePlayerPerformanceDto,
  UpdatePlayerPerformanceDto,
  CreateAnswerPatternDto,
  UpdateAnswerPatternDto,
  CreateAnalyticsSessionDto,
  UpdateAnalyticsSessionDto,
  PlayerPerformanceQueryDto,
  AnswerPatternQueryDto,
  AnalyticsSessionQueryDto,
  AnalyticsInsightsDto,
  CheatingDetectionDto,
  DifficultyAdjustmentDto,
  ImprovementSuggestionsDto,
} from '../dto/analytics.dto';

@Controller('analytics')
@UseGuards(JwtAccessGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnswerAnalyticsService) {}

  // Player Performance Endpoints
  @Post('performance')
  @HttpCode(HttpStatus.CREATED)
  async createPlayerPerformance(
    @Body() dto: CreatePlayerPerformanceDto,
    @CurrentUser() user: any,
  ) {
    return await this.analyticsService.createPlayerPerformance({
      ...dto,
      userId: user.id,
    });
  }

  @Get('performance/:id')
  async getPlayerPerformance(@Param('id') id: string) {
    return await this.analyticsService.getPlayerPerformance(id);
  }

  @Get('performance/user/:userId')
  async getPlayerPerformanceByUserId(@Param('userId') userId: string) {
    return await this.analyticsService.getPlayerPerformanceByUserId(userId);
  }

  @Put('performance/:id')
  async updatePlayerPerformance(
    @Param('id') id: string,
    @Body() dto: UpdatePlayerPerformanceDto,
  ) {
    return await this.analyticsService.updatePlayerPerformance(id, dto);
  }

  @Get('performances')
  async queryPlayerPerformance(@Query() query: PlayerPerformanceQueryDto) {
    return await this.analyticsService.queryPlayerPerformance(query);
  }

  // Answer Pattern Endpoints
  @Post('patterns')
  @HttpCode(HttpStatus.CREATED)
  async createAnswerPattern(
    @Body() dto: CreateAnswerPatternDto,
    @CurrentUser() user: any,
  ) {
    return await this.analyticsService.createAnswerPattern({
      ...dto,
      userId: user.id,
    });
  }

  @Get('patterns/:id')
  async getAnswerPattern(@Param('id') id: string) {
    return await this.analyticsService.getAnswerPattern(id);
  }

  @Put('patterns/:id')
  async updateAnswerPattern(
    @Param('id') id: string,
    @Body() dto: UpdateAnswerPatternDto,
  ) {
    return await this.analyticsService.updateAnswerPattern(id, dto);
  }

  @Get('patterns')
  async queryAnswerPatterns(@Query() query: AnswerPatternQueryDto) {
    return await this.analyticsService.queryAnswerPatterns(query);
  }

  // Analytics Session Endpoints
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  async createAnalyticsSession(
    @Body() dto: CreateAnalyticsSessionDto,
    @CurrentUser() user: any,
  ) {
    return await this.analyticsService.createAnalyticsSession({
      ...dto,
      userId: user.id,
    });
  }

  @Get('sessions/:id')
  async getAnalyticsSession(@Param('id') id: string) {
    return await this.analyticsService.getAnalyticsSession(id);
  }

  @Put('sessions/:id')
  async updateAnalyticsSession(
    @Param('id') id: string,
    @Body() dto: UpdateAnalyticsSessionDto,
  ) {
    return await this.analyticsService.updateAnalyticsSession(id, dto);
  }

  @Get('sessions')
  async queryAnalyticsSessions(@Query() query: AnalyticsSessionQueryDto) {
    return await this.analyticsService.queryAnalyticsSessions(query);
  }

  // Advanced Analytics Endpoints
  @Get('insights/:userId')
  async getPlayerInsights(@Param('userId') userId: string) {
    return await this.analyticsService.analyzePlayerPerformance(userId);
  }

  @Post('cheating-detection')
  async detectCheating(
    @Body() dto: CheatingDetectionDto,
    @CurrentUser() user: any,
  ) {
    return await this.analyticsService.detectCheating({
      ...dto,
      userId: user.id,
    });
  }

  @Post('difficulty-adjustment')
  async adjustDifficulty(
    @Body() dto: DifficultyAdjustmentDto,
    @CurrentUser() user: any,
  ) {
    return await this.analyticsService.adjustDifficulty({
      ...dto,
      userId: user.id,
    });
  }

  @Post('improvement-suggestions')
  async getImprovementSuggestions(
    @Body() dto: ImprovementSuggestionsDto,
    @CurrentUser() user: any,
  ) {
    return await this.analyticsService.generateImprovementSuggestions({
      ...dto,
      userId: user.id,
    });
  }

  @Get('comparative/:userId')
  async getComparativeAnalytics(@Param('userId') userId: string) {
    return await this.analyticsService.getComparativeAnalytics(userId);
  }

  // Dashboard and Summary Endpoints
  @Get('dashboard/:userId')
  async getPlayerDashboard(@Param('userId') userId: string) {
    const performance = await this.analyticsService.getPlayerPerformanceByUserId(userId);
    const patterns = await this.analyticsService.queryAnswerPatterns({
      userId,
      limit: 10,
      offset: 0,
    });
    const sessions = await this.analyticsService.queryAnalyticsSessions({
      userId,
      limit: 5,
      offset: 0,
    });
    const insights = await this.analyticsService.analyzePlayerPerformance(userId);
    const comparative = await this.analyticsService.getComparativeAnalytics(userId);

    return {
      performance,
      recentPatterns: patterns.data,
      recentSessions: sessions.data,
      insights,
      comparative,
      summary: {
        totalRounds: performance.totalRoundsPlayed,
        accuracyRate: performance.accuracyRate,
        performanceLevel: performance.performanceLevel,
        percentileRank: comparative.percentileRank,
        activeAlerts: patterns.data.filter(p => p.isHighSeverity()).length,
      },
    };
  }

  @Get('summary/:userId')
  async getPlayerSummary(@Param('userId') userId: string) {
    const performance = await this.analyticsService.getPlayerPerformanceByUserId(userId);
    const comparative = await this.analyticsService.getComparativeAnalytics(userId);

    return {
      userId,
      performanceLevel: performance.performanceLevel,
      accuracyRate: performance.accuracyRate,
      averageResponseTime: performance.averageResponseTime,
      totalPoints: performance.totalPointsEarned,
      percentileRank: comparative.percentileRank,
      strengths: performance.learningPatterns?.strengths || [],
      weaknesses: performance.learningPatterns?.improvementAreas || [],
      lastUpdated: performance.updatedAt,
    };
  }

  // Real-time Analytics Endpoints
  @Get('realtime/:userId')
  async getRealtimeAnalytics(@Param('userId') userId: string) {
    const performance = await this.analyticsService.getPlayerPerformanceByUserId(userId);
    const recentPatterns = await this.analyticsService.queryAnswerPatterns({
      userId,
      limit: 5,
      offset: 0,
      sortBy: 'createdAt',
      sortOrder: 'DESC',
    });

    return {
      currentPerformance: {
        accuracyRate: performance.accuracyRate,
        averageResponseTime: performance.averageResponseTime,
        performanceLevel: performance.performanceLevel,
      },
      recentPatterns: recentPatterns.data.map(pattern => ({
        type: pattern.patternType,
        severity: pattern.severity,
        confidence: pattern.confidenceScore,
        detectedAt: pattern.createdAt,
      })),
      alerts: recentPatterns.data
        .filter(pattern => pattern.isHighSeverity())
        .map(pattern => ({
          type: pattern.patternType,
          message: `High severity ${pattern.patternType} pattern detected`,
          severity: pattern.severity,
          createdAt: pattern.createdAt,
        })),
    };
  }

  // Analytics Reports
  @Get('reports/performance/:userId')
  async getPerformanceReport(
    @Param('userId') userId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const performance = await this.analyticsService.getPlayerPerformanceByUserId(userId);
    const patterns = await this.analyticsService.queryAnswerPatterns({
      userId,
      startDate,
      endDate,
      limit: 100,
      offset: 0,
    });
    const sessions = await this.analyticsService.queryAnalyticsSessions({
      userId,
      startDate,
      endDate,
      limit: 100,
      offset: 0,
    });

    return {
      period: { startDate, endDate },
      performance,
      patterns: patterns.data,
      sessions: sessions.data,
      metrics: {
        totalSessions: sessions.total,
        totalPatterns: patterns.total,
        averageAccuracy: performance.accuracyRate,
        averageResponseTime: performance.averageResponseTime,
        performanceLevel: performance.performanceLevel,
      },
    };
  }

  @Get('reports/cheating/:userId')
  async getCheatingReport(
    @Param('userId') userId: string,
    @Query('riskThreshold') riskThreshold?: number,
  ) {
    const cheatingDetection = await this.analyticsService.detectCheating({
      userId,
      riskThreshold: riskThreshold || 70,
      includeDetails: true,
    });

    return {
      userId,
      riskScore: cheatingDetection.riskScore,
      riskLevel: cheatingDetection.riskScore > 80 ? 'HIGH' : 
                cheatingDetection.riskScore > 60 ? 'MEDIUM' : 'LOW',
      indicators: cheatingDetection.indicators,
      recommendations: cheatingDetection.recommendations,
      generatedAt: new Date(),
    };
  }
}
