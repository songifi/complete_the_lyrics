import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Lyrics } from './lyrics/entities/lyrics.entity';
import { User } from './users/entities/user.entity';
import { UserStats } from './user-stats/entities/user-stats.entity';
import { Attempt } from './attempts/entities/attempt.entity';
import { FlaggedLyrics } from './flagged-lyrics/entities/flagged-lyrics.entity';
import { Customer } from './payments/entities/customer.entity';
import { Transaction } from './payments/entities/transaction.entity';
import { Subscription } from './payments/entities/subscription.entity';
import { WebhookEvent } from './payments/entities/webhook-event.entity';
import { IdempotencyKey } from './payments/entities/idempotency-key.entity';
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
    Customer,
    Transaction,
    Subscription,
    WebhookEvent,
    IdempotencyKey,
  ],
  migrations: [
    'src/lyrics/migrations/*.ts',
    'src/users/migrations/*.ts',
    'src/user-stats/migrations/*.ts',
    'src/flagged-lyrics/migrations/*.ts',
    'src/payments/migrations/*.ts',
  ],
  synchronize: false,
});
