import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth } from "@nestjs/swagger";
import { GameSessionService } from "./game-session.service";
import {
  CreateSessionDto,
  JoinSessionDto,
  SessionConfiguration,
  ListSessionsQuery,
  ModerationActionDto,
  TransferHostDto,
} from "./types/game-session.types";
import { JwtAccessGuard } from "../auth/guards/jwt-auth.guard";

@Controller("sessions")
export class GameSessionController {
  constructor(private readonly gameSessionService: GameSessionService) {}

  @Post()
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async createSession(@Body() dto: CreateSessionDto) {
    return this.gameSessionService.createSession(dto);
  }

  @Post("join")
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async joinSession(@Body() dto: JoinSessionDto) {
    return this.gameSessionService.joinSession(dto);
  }

  @Delete("leave/:playerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async leaveSession(@Param("playerId") playerId: string) {
    return this.gameSessionService.leaveSession(playerId);
  }

  // History
  @Get("history")
  async listHistory(
    @Query("limit") limit?: number,
    @Query("offset") offset?: number
  ) {
    return this.gameSessionService.listArchivedSessions(
      Number(limit) || 20,
      Number(offset) || 0
    );
  }

  @Get("history/:id")
  async getHistory(@Param("id") id: string) {
    return this.gameSessionService.getArchivedSession(id);
  }

  @Get(":sessionId")
  async getSession(@Param("sessionId") sessionId: string) {
    return this.gameSessionService.getSession(sessionId);
  }

  // Status & Participants
  @Get(":sessionId/status")
  async getSessionStatus(@Param("sessionId") sessionId: string) {
    return this.gameSessionService.getSessionStatus(sessionId);
  }

  @Get(":sessionId/participants")
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async getParticipants(@Param("sessionId") sessionId: string) {
    return this.gameSessionService.getParticipants(sessionId);
  }

  @Get("code/:code")
  async getSessionByCode(@Param("code") code: string) {
    return this.gameSessionService.getSessionByCode(code);
  }

  @Get("player/:playerId")
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async getPlayerSession(@Param("playerId") playerId: string) {
    return this.gameSessionService.getPlayerSession(playerId);
  }

  // Discovery & Listing
  @Get()
  async listSessions(@Query() query: ListSessionsQuery) {
    return this.gameSessionService.listSessions(query);
  }

  @Get("discover/public")
  async discoverPublic(@Query("q") q?: string) {
    return this.gameSessionService.discoverPublicSessions(q);
  }

  @Put(":sessionId/config")
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async updateConfiguration(
    @Param("sessionId") sessionId: string,
    @Query("hostId") hostId: string,
    @Body() configuration: Partial<SessionConfiguration>
  ) {
    return this.gameSessionService.updateConfiguration(
      sessionId,
      hostId,
      configuration
    );
  }

  @Put(":sessionId/state")
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async transitionState(
    @Param("sessionId") sessionId: string,
    @Body("state") state: string
  ) {
    return this.gameSessionService.transitionState(sessionId, state as any);
  }

  @Post(":sessionId/activity/:playerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async updatePlayerActivity(
    @Param("sessionId") sessionId: string,
    @Param("playerId") playerId: string
  ) {
    return this.gameSessionService.updatePlayerActivity(playerId);
  }

  // Moderation
  @Post(":sessionId/moderation/kick")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async kickPlayer(
    @Param("sessionId") sessionId: string,
    @Body() dto: ModerationActionDto
  ) {
    await this.gameSessionService.kickPlayer(sessionId, dto.hostId, dto.targetId);
  }

  @Post(":sessionId/moderation/ban")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async banPlayer(
    @Param("sessionId") sessionId: string,
    @Body() dto: ModerationActionDto
  ) {
    await this.gameSessionService.banPlayer(sessionId, dto.hostId, dto.targetId);
  }

  @Post(":sessionId/moderation/unban")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async unbanPlayer(
    @Param("sessionId") sessionId: string,
    @Body() dto: ModerationActionDto
  ) {
    await this.gameSessionService.unbanPlayer(sessionId, dto.hostId, dto.targetId);
  }

  @Post(":sessionId/moderation/transfer-host")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAccessGuard)
  @ApiBearerAuth()
  async transferHost(
    @Param("sessionId") sessionId: string,
    @Body() dto: TransferHostDto
  ) {
    await this.gameSessionService.transferOwnership(sessionId, dto.hostId, dto.newHostId);
  }

  @Get(":sessionId/analytics")
  async getSessionAnalytics(@Param("sessionId") sessionId: string) {
    return this.gameSessionService.getSessionAnalytics(sessionId);
  }

  @Get("analytics/global")
  async getGlobalAnalytics() {
    return this.gameSessionService.getGlobalAnalytics();
  }
}
