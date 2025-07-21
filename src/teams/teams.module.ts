import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Team } from './entities/team.entity';
import { UserTeam } from './entities/user-team.entity';
import { TeamScore } from './entities/team-score.entity';
import { TeamsService } from './services/teams.service';
import { TeamsController } from './controllers/teams.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Team, UserTeam, TeamScore])],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
