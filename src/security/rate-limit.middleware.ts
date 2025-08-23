import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import Redis from "ioredis";

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator?: (req: Request) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Skip rate limiting for successful requests
  skipFailedRequests?: boolean; // Skip rate limiting for failed requests
}

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private redis: Redis;
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (req: Request) => `${req.ip}:${req.path}`,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config,
    };

    // Initialize Redis connection
    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
    });

    this.redis.on("error", (error) => {
      console.error("Redis connection error:", error);
    });
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const key = this.config.keyGenerator!(req);
      const now = Date.now();
      const windowStart =
        Math.floor(now / this.config.windowMs) * this.config.windowMs;
      const windowEnd = windowStart + this.config.windowMs;
      const remainderMs = windowEnd - now;
      const windowKey = `${key}:${Math.floor(now / this.config.windowMs)}`;

      // Use atomic INCR operation and check if key was first created
      const multiResult = await this.redis
        .multi()
        .incr(windowKey)
        .pttl(windowKey)
        .exec();

      const count = (multiResult?.[0]?.[1] as number) || 0;
      const pttl = (multiResult?.[1]?.[1] as number) || -1;

      // Only set TTL when the key is first created (count === 1) or if it doesn't have TTL
      if (count === 1 || pttl === -1) {
        await this.redis.pexpire(windowKey, remainderMs);
      }

      // Check if rate limit exceeded
      if (count > this.config.maxRequests) {
        const retryAfter = Math.ceil(remainderMs / 1000);
        res.header("Retry-After", retryAfter.toString());
        res.header("X-RateLimit-Limit", this.config.maxRequests.toString());
        res.header("X-RateLimit-Remaining", "0");
        res.header(
          "X-RateLimit-Reset",
          Math.floor(windowEnd / 1000).toString(),
        );

        throw new HttpException(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please try again later.",
            retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // Set rate limit headers with proper window-bound math
      res.header("X-RateLimit-Limit", this.config.maxRequests.toString());
      res.header(
        "X-RateLimit-Remaining",
        Math.max(0, this.config.maxRequests - count).toString(),
      );
      res.header("X-RateLimit-Reset", Math.floor(windowEnd / 1000).toString());

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // If Redis fails, allow the request but log the error
      console.error("Rate limiting error:", error);
      next();
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
