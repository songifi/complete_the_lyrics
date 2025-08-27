import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from "@nestjs/swagger";
import { LeaderboardService } from "../services/leaderboard.service";
import { LeaderboardHistoryService } from "../services/leaderboard-history.service";
import {
  LeaderboardQueryDto,
  FriendLeaderboardQueryDto,
  LeaderboardHistoryQueryDto,
  CreateShareableLeaderboardDto,
} from "../dto/leaderboard-query.dto";
import {
  LeaderboardResponseDto,
  PersonalRankingDto,
  LeaderboardHistoryEntryDto,
  ShareLeaderboardResponseDto,
} from "../dto/leaderboard-response.dto";
import { LeaderboardType } from "../interfaces/leaderboard.interface";

// Assuming you have an AuthGuard
// import { AuthGuard } from '../auth/auth.guard';

@ApiTags("Leaderboard")
@Controller("api/leaderboard")
// @UseGuards(AuthGuard) // Uncomment when you have authentication
export class LeaderboardController {
  constructor(
    private readonly leaderboardService: LeaderboardService,
    private readonly historyService: LeaderboardHistoryService
  ) {}

  @Get("global")
  @ApiOperation({ summary: "Get global leaderboard" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Global leaderboard retrieved successfully",
    type: LeaderboardResponseDto,
  })
  @ApiQuery({ type: LeaderboardQueryDto })
  async getGlobalLeaderboard(
    @Query() query: LeaderboardQueryDto
  ): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getGlobalLeaderboard(query);
  }

  @Get("friends/:userId")
  @ApiOperation({ summary: "Get friend leaderboard for a user" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Friend leaderboard retrieved successfully",
    type: LeaderboardResponseDto,
  })
  @ApiParam({ name: "userId", description: "User ID", type: "string" })
  async getFriendLeaderboard(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query() query: FriendLeaderboardQueryDto
  ): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.getFriendLeaderboard(userId, query);
  }

  @Get("personal/:userId")
  @ApiOperation({ summary: "Get personal ranking for a user" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Personal ranking retrieved successfully",
    type: PersonalRankingDto,
  })
  @ApiParam({ name: "userId", description: "User ID", type: "string" })
  @ApiQuery({ name: "type", enum: LeaderboardType, required: false })
  async getPersonalRanking(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query("type") type?: LeaderboardType
  ): Promise<PersonalRankingDto> {
    return this.leaderboardService.getPersonalRanking(userId, type);
  }

  @Get("history/:userId")
  @ApiOperation({ summary: "Get leaderboard history for a user" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "User history retrieved successfully",
    type: [LeaderboardHistoryEntryDto],
  })
  @ApiParam({ name: "userId", description: "User ID", type: "string" })
  async getUserHistory(
    @Param("userId", ParseUUIDPipe) userId: string,
    @Query() query: LeaderboardHistoryQueryDto
  ): Promise<LeaderboardHistoryEntryDto[]> {
    return this.historyService.getUserHistory(userId, query);
  }

  @Get("history")
  @ApiOperation({ summary: "Get general leaderboard history" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Leaderboard history retrieved successfully",
    type: [LeaderboardHistoryEntryDto],
  })
  async getLeaderboardHistory(
    @Query() query: LeaderboardHistoryQueryDto
  ): Promise<LeaderboardHistoryEntryDto[]> {
    return this.historyService.getLeaderboardHistory(query);
  }

  @Get("search")
  @ApiOperation({ summary: "Search leaderboard entries" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Search results retrieved successfully",
    type: LeaderboardResponseDto,
  })
  @ApiQuery({ name: "q", description: "Search query", type: "string" })
  async searchLeaderboard(
    @Query("q") searchQuery: string,
    @Query() query: LeaderboardQueryDto
  ): Promise<LeaderboardResponseDto> {
    return this.leaderboardService.searchLeaderboard(searchQuery, query);
  }

  @Post("share")
  @ApiOperation({ summary: "Create a shareable leaderboard" })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Shareable leaderboard created successfully",
    type: ShareLeaderboardResponseDto,
  })
  @ApiBearerAuth()
  async createShareableLeaderboard(
    @Body() createShareDto: CreateShareableLeaderboardDto
    // @Request() req: any, // Uncomment when you have authentication
  ): Promise<ShareLeaderboardResponseDto> {
    // const creatorId = req.user.id; // Get from authenticated user
    const creatorId = "00000000-0000-0000-0000-000000000000"; // Placeholder for demo

    const result = await this.leaderboardService.createShareableLeaderboard(
      creatorId,
      createShareDto
    );

    return {
      shareId: result.shareId,
      shareUrl: result.shareUrl,
      title: createShareDto.title,
      description: createShareDto.description,
      createdAt: new Date(),
      expiresAt: createShareDto.expiresAt
        ? new Date(createShareDto.expiresAt)
        : undefined,
    };
  }

  @Get("shared/:shareId")
  @ApiOperation({ summary: "Get a shared leaderboard" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Shared leaderboard retrieved successfully",
  })
  @ApiParam({ name: "shareId", description: "Share ID", type: "string" })
  async getSharedLeaderboard(@Param("shareId") shareId: string) {
    return this.leaderboardService.getShareableLeaderboard(shareId);
  }

  @Get("user/:userId/rank")
  @ApiOperation({ summary: "Get user rank in different leaderboard types" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "User ranks retrieved successfully",
  })
  @ApiParam({ name: "userId", description: "User ID", type: "string" })
  async getUserRanks(@Param("userId", ParseUUIDPipe) userId: string) {
    const globalRank = await this.leaderboardService.getPersonalRanking(
      userId,
      LeaderboardType.GLOBAL
    );

    const weeklyRank = await this.leaderboardService.getPersonalRanking(
      userId,
      LeaderboardType.WEEKLY
    );

    const monthlyRank = await this.leaderboardService.getPersonalRanking(
      userId,
      LeaderboardType.MONTHLY
    );

    return {
      global: globalRank,
      weekly: weeklyRank,
      monthly: monthlyRank,
    };
  }

  // Admin/System endpoints for updating scores
  @Post("update-score")
  @ApiOperation({ summary: "Update user score (Admin/System only)" })
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Score updated successfully",
  })
  async updateUserScore(
    @Body()
    updateScoreDto: {
      userId: string;
      score: number;
      type?: LeaderboardType;
    }
  ) {
    return this.leaderboardService.updateUserScore(
      updateScoreDto.userId,
      updateScoreDto.score,
      updateScoreDto.type || LeaderboardType.GLOBAL
    );
  }
}
