import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Lyrics } from './lyrics/entities/lyrics.entity';
import { ConfigModule } from '@nestjs/config';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [Lyrics],
  migrations: ['src/lyrics/migrations/*.ts'],
  synchronize: false,
});
