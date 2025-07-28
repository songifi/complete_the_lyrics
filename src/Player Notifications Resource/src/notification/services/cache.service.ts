import { Injectable, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import * as Redis from "ioredis"

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name)
  private redis: Redis.Redis

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get("REDIS_HOST", "localhost"),
      port: this.configService.get("REDIS_PORT", 6379),
      password: this.configService.get("REDIS_PASSWORD"),
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    })

    this.redis.on("connect", () => {
      this.logger.log("Connected to Redis")
    })

    this.redis.on("error", (error) => {
      this.logger.error("Redis connection error:", error)
    })
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.redis.get(key)
    } catch (error) {
      this.logger.error(`Failed to get key ${key}: ${error.message}`)
      return null
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, value)
      } else {
        await this.redis.set(key, value)
      }
    } catch (error) {
      this.logger.error(`Failed to set key ${key}: ${error.message}`)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      this.logger.error(`Failed to delete key ${key}: ${error.message}`)
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key)
      return result === 1
    } catch (error) {
      this.logger.error(`Failed to check existence of key ${key}: ${error.message}`)
      return false
    }
  }
}
