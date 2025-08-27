import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule } from "@nestjs/config";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";
import { LeaderboardEntryEntity } from "./leaderboard/entities/leaderboard-entry.entity";
import { LeaderboardHistoryEntity } from "./leaderboard/entities/leaderboard-history.entity";
import { User } from "./users/entities/user.entity";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: "postgres", // or your preferred database
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || "postgres",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "leaderboard_db",
      entities: [User, LeaderboardEntryEntity, LeaderboardHistoryEntity],
      synchronize: process.env.NODE_ENV !== "production", // Don't use in production
      logging: process.env.NODE_ENV === "development",
    }),
    LeaderboardModule,
  ],
})
export class AppModule {}
