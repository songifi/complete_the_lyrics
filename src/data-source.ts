import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Lyrics } from './lyrics/entities/lyrics.entity';
import { User } from './users/entities/user.entity';
import { UserStats } from './user-stats/entities/user-stats.entity';
import { Attempt } from './attempts/entities/attempt.entity';
import { FlaggedLyrics } from './flagged-lyrics/entities/flagged-lyrics.entity';
import { Team } from './teams/entities/team.entity';
import { UserTeam } from './teams/entities/user-team.entity';
import { TeamScore } from './teams/entities/team-score.entity';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [
    Lyrics,
    User,
    UserStats,
    Attempt,
    FlaggedLyrics,
    Team,
    UserTeam,
    TeamScore,
  ],
  migrations: [
    'src/lyrics/migrations/*.ts',
    'src/users/migrations/*.ts',
    'src/user-stats/migrations/*.ts',
    'src/flagged-lyrics/migrations/*.ts',
    'src/teams/migrations/*.ts',
  ],
  synchronize: false,
});
