import { Module } from "@nestjs/common"
import { ConfigModule, ConfigService } from "@nestjs/config"
import { TypeOrmModule } from "@nestjs/typeorm"
import { BullModule } from "@nestjs/bull"
import { ScheduleModule } from "@nestjs/schedule"

import { NotificationModule } from "./notification/notification.module"
import { getDatabaseConfig } from "./config/database.config"
import { getRedisConfig } from "./config/redis.config"

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: getDatabaseConfig,
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        redis: getRedisConfig(configService),
      }),
    }),
    ScheduleModule.forRoot(),
    NotificationModule,
  ],
})
export class AppModule {}
