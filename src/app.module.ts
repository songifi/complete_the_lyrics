import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { SecurityModule } from "./security/security.module";
import { LeaderboardModule } from "./leaderboard/leaderboard.module";
import { AuthModule } from "./auth/auth.module";
import { UserProfilesModule } from "./user-profiles/user-profiles.module";
import { GameRoundModule } from "./GameRound/game-round.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import * as Joi from "joi";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(5432),
        DB_USERNAME: Joi.string().required(),
        DB_PASSWORD: Joi.string().required(),
        DB_NAME: Joi.string().required(),
        NODE_ENV: Joi.string()
          .valid("development", "production", "test")
          .default("development"),
        REDIS_HOST: Joi.string().default("localhost"),
        REDIS_PORT: Joi.number().default(6379),
        REDIS_PASSWORD: Joi.string().optional(),
      }),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.get("DB_HOST"),
        port: configService.get("DB_PORT"),
        username: configService.get("DB_USERNAME"),
        password: configService.get("DB_PASSWORD"),
        database: configService.get("DB_NAME"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: configService.get("NODE_ENV") === "development",
        // Subscribers can be provided via modules; no global subscriber here
      }),
    }),
    SecurityModule,
    LeaderboardModule,
    AuthModule,
    UserProfilesModule,
    GameRoundModule,
    AnalyticsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
