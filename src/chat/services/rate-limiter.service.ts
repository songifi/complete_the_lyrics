import { Injectable } from "@nestjs/common"
import type { RedisService } from "../../../common/services/redis.service"

@Injectable()
export class RateLimiterService {
  constructor(private redisService: RedisService) {}

  async checkRateLimit(userId: string, action = "message"): Promise<boolean> {
    const key = `rate_limit:${action}:${userId}`
    const windowSize = 60 // 1 minute
    const maxRequests = action === "message" ? 30 : 10 // 30 messages per minute, 10 other actions

    const current = await this.redisService.get(key)

    if (!current) {
      await this.redisService.setex(key, windowSize, "1")
      return true
    }

    const count = Number.parseInt(current)
    if (count >= maxRequests) {
      return false
    }

    await this.redisService.incr(key)
    return true
  }

  async getRemainingRequests(userId: string, action = "message"): Promise<number> {
    const key = `rate_limit:${action}:${userId}`
    const maxRequests = action === "message" ? 30 : 10

    const current = await this.redisService.get(key)
    if (!current) return maxRequests

    return Math.max(0, maxRequests - Number.parseInt(current))
  }
}
