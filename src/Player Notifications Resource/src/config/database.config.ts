import type { TypeOrmModuleOptions } from "@nestjs/typeorm"
import type { ConfigService } from "@nestjs/config"

export const getDatabaseConfig = (configService: ConfigService): TypeOrmModuleOptions => ({
  type: "postgres",
  host: configService.get("DB_HOST", "localhost"),
  port: configService.get("DB_PORT", 5432),
  username: configService.get("DB_USERNAME", "postgres"),
  password: configService.get("DB_PASSWORD", "password"),
  database: configService.get("DB_NAME", "notification_db"),
  entities: [__dirname + "/../**/*.entity{.ts,.js}"],
  synchronize: configService.get("NODE_ENV") !== "production",
  logging: configService.get("NODE_ENV") === "development",
  migrations: [__dirname + "/../migrations/*{.ts,.js}"],
  migrationsRun: true,
})
