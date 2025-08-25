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
} from "@nestjs/common";
import { GameSessionService } from "./game-session.service";
import {
  CreateSessionDto,
  JoinSessionDto,
  SessionConfiguration,
} from "./types/game-session.types";

@Controller("sessions")
export class GameSessionController {
  constructor(private readonly gameSessionService: GameSessionService) {}

  @Post()
  async createSession(@Body() dto: CreateSessionDto) {
    return this.gameSessionService.createSession(dto);
  }

  @Post("join")
  async joinSession(@Body() dto: JoinSessionDto) {
    return this.gameSessionService.joinSession(dto);
  }

  @Delete("leave/:playerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async leaveSession(@Param("playerId") playerId: string) {
    return this.gameSessionService.leaveSession(playerId);
  }

  @Get(":sessionId")
  async getSession(@Param("sessionId") sessionId: string) {
    return this.gameSessionService.getSession(sessionId);
  }

  @Get("code/:code")
  async getSessionByCode(@Param("code") code: string) {
    return this.gameSessionService.getSessionByCode(code);
  }

  @Get("player/:playerId")
  async getPlayerSession(@Param("playerId") playerId: string) {
    return this.gameSessionService.getPlayerSession(playerId);
  }

  @Put(":sessionId/config")
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
  async transitionState(
    @Param("sessionId") sessionId: string,
    @Body("state") state: string
  ) {
    return this.gameSessionService.transitionState(sessionId, state as any);
  }

  @Post(":sessionId/activity/:playerId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async updatePlayerActivity(
    @Param("sessionId") sessionId: string,
    @Param("playerId") playerId: string
  ) {
    return this.gameSessionService.updatePlayerActivity(playerId);
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
