import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Team } from '../entities/team.entity';
import {
  UserTeam,
  UserTeamRole,
  UserTeamStatus,
} from '../entities/user-team.entity';
import { TeamScore, ScorePeriod } from '../entities/team-score.entity';
import { CreateTeamDto } from '../dto/create-team.dto';
import {
  TeamResponseDto,
  TeamLeaderboardDto,
  TeamMemberDto,
} from '../dto/team-response.dto';

@Injectable()
export class TeamsService {
  constructor(
    @InjectRepository(Team)
    private teamRepository: Repository<Team>,
    @InjectRepository(UserTeam)
    private userTeamRepository: Repository<UserTeam>,
    @InjectRepository(TeamScore)
    private teamScoreRepository: Repository<TeamScore>,
    private dataSource: DataSource,
  ) {}

  async createTeam(
    createTeamDto: CreateTeamDto,
    createdByUserId: string,
  ): Promise<TeamResponseDto> {
    // Check if user is already in a team
    const existingMembership = await this.userTeamRepository.findOne({
      where: {
        userId: createdByUserId,
        status: UserTeamStatus.ACTIVE,
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of a team');
    }

    // Check if team name already exists
    const existingTeam = await this.teamRepository.findOne({
      where: { name: createTeamDto.name },
    });

    if (existingTeam) {
      throw new ConflictException('Team name already exists');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create team
      const team = queryRunner.manager.create(Team, {
        ...createTeamDto,
        createdByUserId,
        memberCount: 1,
      });
      const savedTeam = await queryRunner.manager.save(team);

      // Add creator as team captain
      const userTeam = queryRunner.manager.create(UserTeam, {
        userId: createdByUserId,
        teamId: savedTeam.id,
        role: UserTeamRole.CAPTAIN,
        status: UserTeamStatus.ACTIVE,
      });
      await queryRunner.manager.save(userTeam);

      await queryRunner.commitTransaction();

      return {
        id: savedTeam.id,
        name: savedTeam.name,
        description: savedTeam.description,
        createdByUserId: savedTeam.createdByUserId,
        totalScore: savedTeam.totalScore,
        memberCount: savedTeam.memberCount,
        createdAt: savedTeam.createdAt,
        updatedAt: savedTeam.updatedAt,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async joinTeam(teamId: number, userId: string): Promise<{ message: string }> {
    // Check if user is already in a team
    const existingMembership = await this.userTeamRepository.findOne({
      where: {
        userId,
        status: UserTeamStatus.ACTIVE,
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of a team');
    }

    // Check if team exists
    const team = await this.teamRepository.findOne({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Add user to team
      const userTeam = queryRunner.manager.create(UserTeam, {
        userId,
        teamId,
        role: UserTeamRole.MEMBER,
        status: UserTeamStatus.ACTIVE,
      });
      await queryRunner.manager.save(userTeam);

      // Update team member count
      await queryRunner.manager.increment(
        Team,
        { id: teamId },
        'memberCount',
        1,
      );

      await queryRunner.commitTransaction();

      return { message: `Successfully joined team ${team.name}` };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async leaveTeam(userId: string): Promise<{ message: string }> {
    const userTeam = await this.userTeamRepository.findOne({
      where: {
        userId,
        status: UserTeamStatus.ACTIVE,
      },
      relations: ['team'],
    });

    if (!userTeam) {
      throw new NotFoundException('User is not a member of any team');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update user team status
      userTeam.status = UserTeamStatus.LEFT;
      userTeam.leftAt = new Date();
      await queryRunner.manager.save(userTeam);

      // Decrease team member count
      await queryRunner.manager.decrement(
        Team,
        { id: userTeam.teamId },
        'memberCount',
        1,
      );

      await queryRunner.commitTransaction();

      return { message: `Successfully left team ${userTeam.team.name}` };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getTeamById(
    id: number,
    includeMembers = false,
  ): Promise<TeamResponseDto> {
    const team = await this.teamRepository.findOne({
      where: { id },
      relations: includeMembers ? ['userTeams', 'userTeams.user'] : [],
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${id} not found`);
    }

    const response: TeamResponseDto = {
      id: team.id,
      name: team.name,
      description: team.description,
      createdByUserId: team.createdByUserId,
      totalScore: team.totalScore,
      memberCount: team.memberCount,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };

    if (includeMembers && team.userTeams) {
      response.members = team.userTeams
        .filter((ut) => ut.status === UserTeamStatus.ACTIVE)
        .map(
          (ut): TeamMemberDto => ({
            userId: ut.userId,
            username: ut.user.username,
            role: ut.role,
            status: ut.status,
            contributedScore: ut.contributedScore,
            joinedAt: ut.joinedAt,
          }),
        );
    }

    return response;
  }

  async getTeamLeaderboard(
    period: ScorePeriod = ScorePeriod.ALL_TIME,
  ): Promise<TeamLeaderboardDto[]> {
    let query = this.teamRepository
      .createQueryBuilder('team')
      .select(['team.id', 'team.name', 'team.memberCount', 'team.totalScore'])
      .where('team.memberCount > 0')
      .orderBy('team.totalScore', 'DESC')
      .limit(50);

    if (period !== ScorePeriod.ALL_TIME) {
      // Join with team_scores for specific periods
      query = query
        .leftJoin('team.teamScores', 'ts')
        .addSelect(['ts.score', 'ts.averageAccuracy'])
        .andWhere('ts.period = :period', { period });
    }

    const teams = await query.getMany();

    return teams.map((team, index) => ({
      rank: index + 1,
      team: {
        id: team.id,
        name: team.name,
        memberCount: team.memberCount,
      },
      totalScore: team.totalScore,
      weeklyScore:
        period === ScorePeriod.WEEKLY ? team.teamScores?.[0]?.score : undefined,
      averageAccuracy: team.teamScores?.[0]?.averageAccuracy || 0,
    }));
  }

  async getUserCurrentTeam(userId: string): Promise<TeamResponseDto | null> {
    const userTeam = await this.userTeamRepository.findOne({
      where: {
        userId,
        status: UserTeamStatus.ACTIVE,
      },
      relations: ['team'],
    });

    if (!userTeam) {
      return null;
    }

    return this.getTeamById(userTeam.teamId);
  }

  async updateTeamScore(teamId: number, scoreIncrease: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Update team total score
      await queryRunner.manager.increment(
        Team,
        { id: teamId },
        'totalScore',
        scoreIncrease,
      );

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAllTeams(limit: number = 20): Promise<TeamResponseDto[]> {
    const teams = await this.teamRepository.find({
      order: { totalScore: 'DESC' },
      take: limit,
    });

    return teams.map(
      (team): TeamResponseDto => ({
        id: team.id,
        name: team.name,
        description: team.description,
        createdByUserId: team.createdByUserId,
        totalScore: team.totalScore,
        memberCount: team.memberCount,
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
      }),
    );
  }
}
