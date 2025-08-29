import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
} from "@nestjs/swagger";
import { LeaderboardService } from "../leaderboard.service";
import {
  LeaderboardType,
  LeaderboardPeriod,
} from "../entities/leaderboard.entity";
import { LeaderboardEntry } from "../entities/leaderboard-entry.entity";
import {
  UpdateScoreDto,
  GetRankingsDto,
  GetUserRankDto,
  LeaderboardStatsDto,
  ResetLeaderboardDto,
  ResetPeriodDto,
  LeaderboardEntryResponseDto,
  UserRankResponseDto,
  LeaderboardStatsResponseDto,
  SuccessResponseDto,
  AvailablePeriodsResponseDto,
  AvailableTypesResponseDto,
} from "../dto/leaderboard.dto";

@ApiTags("leaderboard")
@Controller("leaderboard")
@UsePipes(new ValidationPipe({ transform: true }))
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get("rankings")
  @ApiOperation({ summary: "Get leaderboard rankings" })
  @ApiQuery({
    name: "type",
    enum: LeaderboardType,
    description: "Leaderboard type",
  })
  @ApiQuery({
    name: "period",
    enum: LeaderboardPeriod,
    description: "Time period",
  })
  @ApiQuery({
    name: "category",
    type: String,
    description: "Leaderboard category",
  })
  @ApiQuery({
    name: "limit",
    type: Number,
    required: false,
    description: "Number of entries to return",
  })
  @ApiResponse({
    status: 200,
    description: "Successfully retrieved rankings",
    type: [LeaderboardEntryResponseDto],
  })
  async getRankings(
    @Query() query: GetRankingsDto,
  ): Promise<LeaderboardEntryResponseDto[]> {
    const { type, period, category, limit = 100 } = query;
    return this.leaderboardService.getRankings(type, period, category, limit);
  }

  @Get("top/:limit")
  @ApiOperation({ summary: "Get top players" })
  @ApiParam({
    name: "limit",
    type: Number,
    description: "Number of top players to return",
  })
  @ApiQuery({
    name: "type",
    enum: LeaderboardType,
    description: "Leaderboard type",
  })
  @ApiQuery({
    name: "period",
    enum: LeaderboardPeriod,
    description: "Time period",
  })
  @ApiQuery({
    name: "category",
    type: String,
    description: "Leaderboard category",
  })
  @ApiResponse({
    status: 200,
    description: "Successfully retrieved top players",
    type: [LeaderboardEntry],
  })
  async getTopPlayers(
    @Param("limit") limit: number,
    @Query("type") type: LeaderboardType,
    @Query("period") period: LeaderboardPeriod,
    @Query("category") category: string,
  ): Promise<LeaderboardEntry[]> {
    return this.leaderboardService.getTopPlayers(type, period, category, limit);
  }

  @Get("user/:userId/rank")
  @ApiOperation({ summary: "Get user rank and surrounding players" })
  @ApiParam({ name: "userId", type: String, description: "User ID" })
  @ApiQuery({
    name: "type",
    enum: LeaderboardType,
    description: "Leaderboard type",
  })
  @ApiQuery({
    name: "period",
    enum: LeaderboardPeriod,
    description: "Time period",
  })
  @ApiQuery({
    name: "category",
    type: String,
    description: "Leaderboard category",
  })
  @ApiQuery({
    name: "range",
    type: Number,
    required: false,
    description: "Range around user rank",
  })
  @ApiResponse({
    status: 200,
    description: "Successfully retrieved user rank information",
    schema: {
      properties: {
        rank: { type: "number", nullable: true },
        usersAround: {
          type: "array",
          items: { $ref: "#/components/schemas/LeaderboardEntry" },
        },
      },
    },
  })
  async getUserRank(
    @Param("userId") userId: string,
    @Query("type") type: LeaderboardType,
    @Query("period") period: LeaderboardPeriod,
    @Query("category") category: string,
    @Query("range") range: number = 5,
  ): Promise<{ rank: number | null; usersAround: LeaderboardEntry[] }> {
    const rank = await this.leaderboardService.getUserRank(
      userId,
      type,
      period,
      category,
    );
    const usersAround = await this.leaderboardService.getUsersAroundRank(
      userId,
      type,
      period,
      category,
      range,
    );

    return { rank, usersAround };
  }

  @Get("stats")
  @ApiOperation({ summary: "Get leaderboard statistics" })
  @ApiQuery({
    name: "type",
    enum: LeaderboardType,
    description: "Leaderboard type",
  })
  @ApiQuery({
    name: "period",
    enum: LeaderboardPeriod,
    description: "Time period",
  })
  @ApiQuery({
    name: "category",
    type: String,
    description: "Leaderboard category",
  })
  @ApiResponse({
    status: 200,
    description: "Successfully retrieved leaderboard statistics",
    schema: {
      properties: {
        totalPlayers: { type: "number" },
        averageScore: { type: "number" },
        topScore: { type: "number" },
        lastUpdated: { type: "string", format: "date-time" },
      },
    },
  })
  async getLeaderboardStats(
    @Query("type") type: LeaderboardType,
    @Query("period") period: LeaderboardPeriod,
    @Query("category") category: string,
  ): Promise<{
    totalPlayers: number;
    averageScore: number;
    topScore: number;
    lastUpdated: Date;
  }> {
    return this.leaderboardService.getLeaderboardStats(type, period, category);
  }

  @Post("score")
  @ApiOperation({ summary: "Update user score" })
  @ApiResponse({ status: 201, description: "Score updated successfully" })
  @ApiResponse({ status: 400, description: "Invalid input data" })
  @HttpCode(HttpStatus.CREATED)
  async updateScore(
    @Body() updateScoreDto: UpdateScoreDto,
  ): Promise<{ success: boolean; message: string }> {
    const { userId, score, type, period, category, metadata } = updateScoreDto;

    await this.leaderboardService.updateUserScore(
      userId,
      score,
      type,
      period,
      category,
      metadata,
    );

    return {
      success: true,
      message: "Score updated successfully",
    };
  }

  @Post("reset/:leaderboardId")
  @ApiOperation({ summary: "Reset a specific leaderboard" })
  @ApiParam({
    name: "leaderboardId",
    type: String,
    description: "Leaderboard ID to reset",
  })
  @ApiResponse({ status: 200, description: "Leaderboard reset successfully" })
  @HttpCode(HttpStatus.OK)
  async resetLeaderboard(
    @Param("leaderboardId") leaderboardId: string,
  ): Promise<{ success: boolean; message: string }> {
    await this.leaderboardService.resetLeaderboard(leaderboardId);

    return {
      success: true,
      message: "Leaderboard reset successfully",
    };
  }

  @Post("reset/period/:period")
  @ApiOperation({ summary: "Reset all leaderboards for a specific period" })
  @ApiParam({
    name: "period",
    enum: LeaderboardPeriod,
    description: "Period to reset",
  })
  @ApiResponse({ status: 200, description: "Leaderboards reset successfully" })
  @HttpCode(HttpStatus.OK)
  async resetLeaderboardsByPeriod(
    @Param("period") period: LeaderboardPeriod,
  ): Promise<{ success: boolean; message: string }> {
    await this.leaderboardService.resetLeaderboardsByPeriod(period);

    return {
      success: true,
      message: `All ${period} leaderboards reset successfully`,
    };
  }

  @Get("archive/:leaderboardId")
  @ApiOperation({ summary: "Get archived leaderboard data" })
  @ApiParam({
    name: "leaderboardId",
    type: String,
    description: "Original leaderboard ID",
  })
  @ApiResponse({
    status: 200,
    description: "Successfully retrieved archived leaderboard data",
  })
  async getArchivedLeaderboard(@Param("leaderboardId") leaderboardId: string) {
    // Implementation would fetch from LeaderboardArchive
    // This is a placeholder for the archive functionality
    return {
      message: "Archive retrieval not implemented yet",
      leaderboardId,
    };
  }

  @Get("periods")
  @ApiOperation({ summary: "Get all available leaderboard periods" })
  @ApiResponse({
    status: 200,
    description: "Successfully retrieved available periods",
    schema: {
      properties: {
        periods: {
          type: "array",
          items: { type: "string", enum: Object.values(LeaderboardPeriod) },
        },
      },
    },
  })
  async getAvailablePeriods(): Promise<{ periods: LeaderboardPeriod[] }> {
    return {
      periods: Object.values(LeaderboardPeriod),
    };
  }

  @Get("types")
  @ApiOperation({ summary: "Get all available leaderboard types" })
  @ApiResponse({
    status: 200,
    description: "Successfully retrieved available types",
    schema: {
      properties: {
        types: {
          type: "array",
          items: { type: "string", enum: Object.values(LeaderboardType) },
        },
      },
    },
  })
  async getAvailableTypes(): Promise<{ types: LeaderboardType[] }> {
    return {
      types: Object.values(LeaderboardType),
    };
  }
}
