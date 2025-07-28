import type { ConfigService } from "@nestjs/config"

export const getRedisConfig = (configService: ConfigService) => ({
  host: configService.get("REDIS_HOST", "localhost"),
  port: configService.get("REDIS_PORT", 6379),
  password: configService.get("REDIS_PASSWORD"),
  db: configService.get("REDIS_DB", 0),
})
