import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  ClassSerializerInterceptor,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { plainToClass } from 'class-transformer';
import { TournamentService } from '../services/tournament.service';
import { CreateTournamentDto } from '../dto/create-tournament.dto';
import { UpdateTournamentDto } from '../dto/update-tournament.dto';
import { RegisterParticipantDto } from '../dto/register-participant.dto';
import { RecordMatchResultDto } from '../dto/record-match-result.dto';
import { TournamentQueryDto } from '../dto/tournament-query.dto';
import {
  TournamentResponseDto,
  PaginatedTournamentResponseDto,
  ParticipantResponseDto,
  MatchResponseDto,
  BracketResponseDto,
  LeaderboardResponseDto,
} from '../dto/tournament-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { TournamentOwnerGuard } from '../guards/tournament-owner.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { CacheInterceptor } from '../interceptors/cache.interceptor';
import { LoggingInterceptor } from '../interceptors/logging.interceptor';

@ApiTags('tournaments')
@Controller('tournaments')
@UseInterceptors(ClassSerializerInterceptor, LoggingInterceptor)
@ApiBearerAuth()
export class TournamentController {
  constructor(private readonly tournamentService: TournamentService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new tournament' })
  @ApiCreatedResponse({
    description: 'Tournament created successfully',
    type: TournamentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid tournament data' })
  async createTournament(
    @Body() createTournamentDto: CreateTournamentDto,
    @CurrentUser() user: any,
  ): Promise<TournamentResponseDto> {
    const tournament = await this.tournamentService.createTournament({
      ...createTournamentDto,
      createdBy: user.id,
      registrationStartAt: new Date(createTournamentDto.registrationStartAt),
      registrationEndAt: new Date(createTournamentDto.registrationEndAt),
      startAt: new Date(createTournamentDto.startAt),
    });

    return plainToClass(TournamentResponseDto, tournament, {
      excludeExtraneousValues: true,
    });
  }

  @Get()
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get tournaments with pagination and filtering' })
  @ApiOkResponse({
    description: 'Tournaments retrieved successfully',
    type: PaginatedTournamentResponseDto,
  })
  async getTournaments(
    @Query() query: TournamentQueryDto,
  ): Promise<PaginatedTournamentResponseDto> {
    const result = await this.tournamentService.getTournaments(query);

    return {
      data: result.data.map((tournament) =>
        plainToClass(TournamentResponseDto, tournament, {
          excludeExtraneousValues: true,
        }),
      ),
      total: result.total,
      page: query.page || 1,
      limit: query.limit || 20,
      totalPages: Math.ceil(result.total / (query.limit || 20)),
      hasNext: (query.page || 1) * (query.limit || 20) < result.total,
      hasPrev: (query.page || 1) > 1,
    };
  }

  @Get(':id')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get tournament by ID' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiOkResponse({
    description: 'Tournament found',
    type: TournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  async getTournament(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TournamentResponseDto> {
    const tournament = await this.tournamentService.getTournament(id);

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return plainToClass(TournamentResponseDto, tournament, {
      excludeExtraneousValues: true,
    });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, TournamentOwnerGuard)
  @ApiOperation({ summary: 'Update tournament' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiOkResponse({
    description: 'Tournament updated successfully',
    type: TournamentResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  @ApiBadRequestResponse({ description: 'Invalid update data' })
  async updateTournament(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTournamentDto: UpdateTournamentDto,
  ): Promise<TournamentResponseDto> {
    const tournament = await this.tournamentService.updateTournament(
      id,
      updateTournamentDto,
    );

    return plainToClass(TournamentResponseDto, tournament, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, TournamentOwnerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete tournament' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiResponse({ status: 204, description: 'Tournament deleted successfully' })
  @ApiNotFoundResponse({ description: 'Tournament not found' })
  async deleteTournament(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    await this.tournamentService.deleteTournament(id);
  }

  @Post(':id/participants')
  @UseGuards(JwtAuthGuard, RateLimitGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register participant for tournament' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiCreatedResponse({
    description: 'Participant registered successfully',
    type: ParticipantResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Registration failed' })
  async registerParticipant(
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @Body() registerDto: RegisterParticipantDto,
  ): Promise<ParticipantResponseDto> {
    const participant = await this.tournamentService.registerParticipant(
      tournamentId,
      registerDto.playerId,
      registerDto.teamId,
    );

    return plainToClass(ParticipantResponseDto, participant, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id/participants')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get tournament participants' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiOkResponse({
    description: 'Participants retrieved successfully',
    type: [ParticipantResponseDto],
  })
  async getParticipants(
    @Param('id', ParseUUIDPipe) tournamentId: string,
  ): Promise<ParticipantResponseDto[]> {
    const participants =
      await this.tournamentService.getParticipants(tournamentId);

    return participants.map((participant) =>
      plainToClass(ParticipantResponseDto, participant, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Delete(':id/participants/:participantId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove participant from tournament' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'participantId', description: 'Participant ID' })
  @ApiResponse({ status: 204, description: 'Participant removed successfully' })
  async removeParticipant(
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @Param('participantId', ParseUUIDPipe) participantId: string,
    @CurrentUser() user: any,
  ): Promise<void> {
    await this.tournamentService.removeParticipant(
      tournamentId,
      participantId,
      user.id,
    );
  }

  @Post(':id/start')
  @UseGuards(JwtAuthGuard, TournamentOwnerGuard)
  @ApiOperation({ summary: 'Start tournament' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiOkResponse({
    description: 'Tournament started successfully',
    type: TournamentResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Tournament cannot be started' })
  async startTournament(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TournamentResponseDto> {
    const tournament = await this.tournamentService.startTournament(id);

    return plainToClass(TournamentResponseDto, tournament, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id/matches')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get tournament matches' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiQuery({ name: 'round', required: false, description: 'Filter by round' })
  @ApiOkResponse({
    description: 'Matches retrieved successfully',
    type: [MatchResponseDto],
  })
  async getMatches(
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @Query('round') round?: number,
  ): Promise<MatchResponseDto[]> {
    const matches = await this.tournamentService.getMatches(
      tournamentId,
      round,
    );

    return matches.map((match) =>
      plainToClass(MatchResponseDto, match, {
        excludeExtraneousValues: true,
      }),
    );
  }

  @Post(':id/matches/:matchId/result')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Record match result' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiParam({ name: 'matchId', description: 'Match ID' })
  @ApiOkResponse({
    description: 'Match result recorded successfully',
    type: MatchResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid match result' })
  async recordMatchResult(
    @Param('id', ParseUUIDPipe) tournamentId: string,
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() resultDto: RecordMatchResultDto,
  ): Promise<MatchResponseDto> {
    const match = await this.tournamentService.recordMatchResult(matchId, {
      ...resultDto,
      matchId,
    });

    return plainToClass(MatchResponseDto, match, {
      excludeExtraneousValues: true,
    });
  }

  @Get(':id/bracket')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get tournament bracket' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiOkResponse({
    description: 'Bracket retrieved successfully',
    type: BracketResponseDto,
  })
  async getBracket(
    @Param('id', ParseUUIDPipe) tournamentId: string,
  ): Promise<BracketResponseDto | null> {
    return await this.tournamentService.getTournamentBracket(tournamentId);
  }

  @Get(':id/leaderboard')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get tournament leaderboard' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiOkResponse({
    description: 'Leaderboard retrieved successfully',
    type: LeaderboardResponseDto,
  })
  async getLeaderboard(
    @Param('id', ParseUUIDPipe) tournamentId: string,
  ): Promise<LeaderboardResponseDto> {
    const participants =
      await this.tournamentService.getLeaderboard(tournamentId);

    return {
      participants: participants.map((participant) =>
        plainToClass(ParticipantResponseDto, participant, {
          excludeExtraneousValues: true,
        }),
      ),
      lastUpdated: new Date(),
    };
  }

  @Get(':id/stats')
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get tournament statistics' })
  @ApiParam({ name: 'id', description: 'Tournament ID' })
  @ApiOkResponse({ description: 'Statistics retrieved successfully' })
  async getTournamentStats(
    @Param('id', ParseUUIDPipe) tournamentId: string,
  ): Promise<any> {
    return await this.tournamentService.getTournamentStats(tournamentId);
  }
}
