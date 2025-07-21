import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  ParseIntPipe,
  Query,
  DefaultValuePipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentUser } from '../../auth/current-user.decorator';
import { TeamsService } from '../services/teams.service';
import { CreateTeamDto } from '../dto/create-team.dto';
import { TeamResponseDto, TeamLeaderboardDto } from '../dto/team-response.dto';
import { ScorePeriod } from '../entities/team-score.entity';

@Controller('teams')
@UseGuards(JwtAuthGuard)
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  async createTeam(
    @Body() createTeamDto: CreateTeamDto,
    @CurrentUser('id') userId: string,
  ): Promise<TeamResponseDto> {
    return await this.teamsService.createTeam(createTeamDto, userId);
  }

  @Post(':id/join')
  async joinTeam(
    @Param('id', ParseIntPipe) teamId: number,
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string }> {
    return await this.teamsService.joinTeam(teamId, userId);
  }

  @Get('leaderboard')
  async getTeamLeaderboard(
    @Query('period') period?: ScorePeriod,
  ): Promise<TeamLeaderboardDto[]> {
    return await this.teamsService.getTeamLeaderboard(
      period || ScorePeriod.ALL_TIME,
    );
  }

  @Get('my-team')
  async getMyTeam(
    @CurrentUser('id') userId: string,
  ): Promise<TeamResponseDto | null> {
    return await this.teamsService.getUserCurrentTeam(userId);
  }

  @Get(':id')
  async getTeamById(
    @Param('id', ParseIntPipe) id: number,
    @Query('includeMembers', new DefaultValuePipe(false))
    includeMembers: boolean,
  ): Promise<TeamResponseDto> {
    return await this.teamsService.getTeamById(id, includeMembers);
  }

  @Get()
  async getAllTeams(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<TeamResponseDto[]> {
    // Ensure limit is within reasonable bounds
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    return await this.teamsService.getAllTeams(safeLimit);
  }

  @Post('leave')
  async leaveTeam(
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string }> {
    return await this.teamsService.leaveTeam(userId);
  }
}
