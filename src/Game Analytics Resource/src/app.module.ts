import { Module } from "@nestjs/common"
import { ConfigModule } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { GraphQLModule } from "@nestjs/graphql"
import { ApolloDriver, type ApolloDriverConfig } from "@nestjs/apollo"
import { BullModule } from "@nestjs/bull"
import { ScheduleModule } from "@nestjs/schedule"

import { AnalyticsModule } from "./analytics/analytics.module"
import { EventsModule } from "./events/events.module"
import { MetricsModule } from "./metrics/metrics.module"
import { PlayerModule } from "./player/player.module"
import { ABTestingModule } from "./ab-testing/ab-testing.module"
import { PredictiveModule } from "./predictive/predictive.module"
import { RealtimeModule } from "./realtime/realtime.module"
import { DataPipelineModule } from "./data-pipeline/data-pipeline.module"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: Number.parseInt(process.env.DB_PORT) || 5432,
      username: process.env.DB_USERNAME || "postgres",
      password: process.env.DB_PASSWORD || "password",
      database: process.env.DB_NAME || "analytics",
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== "production",
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
      introspection: true,
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: Number.parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    ScheduleModule.forRoot(),
    AnalyticsModule,
    EventsModule,
    MetricsModule,
    PlayerModule,
    ABTestingModule,
    PredictiveModule,
    RealtimeModule,
    DataPipelineModule,
  ],
})
export class AppModule {}
