import { Controller, Get, Post, Patch, Param, Delete, Query, HttpCode, HttpStatus } from "@nestjs/common"
import type { MatchHistoryService } from "../services/match-history.service"
import type { CreateMatchHistoryDto } from "../dto/create-match-history.dto"
import type { UpdateMatchHistoryDto } from "../dto/update-match-history.dto"
import type { MatchQueryDto } from "../dto/match-query.dto"

@Controller("match-history")
export class MatchHistoryController {
  constructor(private readonly matchHistoryService: MatchHistoryService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(createMatchHistoryDto: CreateMatchHistoryDto) {
    return this.matchHistoryService.createMatch(createMatchHistoryDto)
  }

  @Get()
  findAll(query: MatchQueryDto) {
    return this.matchHistoryService.findAllMatches(query)
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.matchHistoryService.findMatchById(id)
  }

  @Patch(":id")
  update(@Param("id") id: string, updateMatchHistoryDto: UpdateMatchHistoryDto) {
    return this.matchHistoryService.updateMatch(id, updateMatchHistoryDto)
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param("id") id: string) {
    return this.matchHistoryService.deleteMatch(id)
  }

  @Get(":id/replay")
  getReplay(@Param("id") id: string) {
    return this.matchHistoryService.getMatchReplay(id)
  }

  @Get(":id/analysis")
  getPerformanceAnalysis(@Param("id") id: string, @Query("userId") userId?: string) {
    return this.matchHistoryService.getMatchPerformanceAnalysis(id, userId)
  }

  @Get("player/:userId")
  getPlayerMatchHistory(@Param("userId") userId: string, @Query() query: MatchQueryDto) {
    return this.matchHistoryService.getPlayerMatchHistory(userId, query)
  }

  @Get("compare/:matchId1/:matchId2")
  getMatchComparison(@Param("matchId1") matchId1: string, @Param("matchId2") matchId2: string) {
    return this.matchHistoryService.getMatchComparison(matchId1, matchId2)
  }

  @Get("player/:userId/trends")
  getPlayerTrends(@Param("userId") userId: string, @Query("limit") limit?: string) {
    return this.matchHistoryService.getPlayerTrends(userId, limit ? Number.parseInt(limit, 10) : undefined)
  }
}
