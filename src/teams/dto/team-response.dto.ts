import { UserTeamRole, UserTeamStatus } from '../entities/user-team.entity';
import { ScorePeriod } from '../entities/team-score.entity';

export class TeamMemberDto {
  userId: string;
  username: string;
  role: UserTeamRole;
  status: UserTeamStatus;
  contributedScore: number;
  joinedAt: Date;
}

export class TeamScoreDto {
  period: ScorePeriod;
  score: number;
  totalAttempts: number;
  correctAttempts: number;
  averageAccuracy: number;
  periodStart: Date;
  periodEnd: Date;
}

export class TeamResponseDto {
  id: number;
  name: string;
  description?: string;
  createdByUserId: string;
  totalScore: number;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
  members?: TeamMemberDto[];
  scores?: TeamScoreDto[];
}

export class TeamLeaderboardDto {
  rank: number;
  team: {
    id: number;
    name: string;
    memberCount: number;
  };
  totalScore: number;
  weeklyScore?: number;
  averageAccuracy: number;
}
