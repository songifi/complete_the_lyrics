import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Redis } from 'ioredis';
import { TournamentCacheService } from '../services/tournament-cache.service';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  message?: string;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheService: TournamentCacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Default rate limit: 100 requests per 15 minutes
    const defaultOptions: RateLimitOptions = {
      limit: 100,
      windowMs: 15 * 60 * 1000, // 15 minutes
      message: 'Too many requests from this user',
    };

    // Get custom options from decorator if available
    const customOptions = this.reflector.get<RateLimitOptions>(
      'rateLimit',
      context.getHandler(),
    );

    const options = { ...defaultOptions, ...customOptions };

    if (!user) {
      // For anonymous users, use IP-based rate limiting
      return this.checkIPRateLimit(request, options);
    }

    // For authenticated users, use user-based rate limiting
    return this.checkUserRateLimit(user, options);
  }

  private async checkUserRateLimit(
    user: any,
    options: RateLimitOptions,
  ): Promise<boolean> {
    const key = `rate_limit:user:${user.sub || user.id}`;
    const windowSeconds = Math.ceil(options.windowMs / 1000);

    const allowed = await this.cacheService.setRateLimitKey(
      key,
      options.limit,
      windowSeconds,
    );

    if (!allowed) {
      const remaining = await this.cacheService.getRemainingRequests(
        key,
        options.limit,
      );
      throw new HttpException(
        {
          message: options.message,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          limit: options.limit,
          remaining,
          resetTime: new Date(Date.now() + options.windowMs),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private async checkIPRateLimit(
    request: any,
    options: RateLimitOptions,
  ): Promise<boolean> {
    const ip = this.getClientIP(request);
    const key = `rate_limit:ip:${ip}`;
    const windowSeconds = Math.ceil(options.windowMs / 1000);

    const allowed = await this.cacheService.setRateLimitKey(
      key,
      options.limit,
      windowSeconds,
    );

    if (!allowed) {
      const remaining = await this.cacheService.getRemainingRequests(
        key,
        options.limit,
      );
      throw new HttpException(
        {
          message: options.message,
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          limit: options.limit,
          remaining,
          resetTime: new Date(Date.now() + options.windowMs),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }

  private getClientIP(request: any): string {
    return (
      request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      request.ip ||
      '0.0.0.0'
    );
  }
}

// Decorator for custom rate limiting
export const RateLimit = (options: Partial<RateLimitOptions>) =>
  Reflect.metadata('rateLimit', options);
