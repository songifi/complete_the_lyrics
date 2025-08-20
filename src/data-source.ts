import { DataSource } from 'typeorm';
import { Leaderboard } from './leaderboard/entities/leaderboard.entity';
import { LeaderboardEntry } from './leaderboard/entities/leaderboard-entry.entity';
import { LeaderboardArchive } from './leaderboard/entities/leaderboard-archive.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'complete_lyrics',
  synchronize: true,
  logging: false,
  entities: [Leaderboard, LeaderboardEntry, LeaderboardArchive],
  migrations: [],
  subscribers: [],
});

module.exports = AppDataSource;