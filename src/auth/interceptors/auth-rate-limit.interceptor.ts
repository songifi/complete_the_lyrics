import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

@Injectable()
export class AuthRateLimitInterceptor implements NestInterceptor, OnModuleDestroy {
  private readonly logger = new Logger(AuthRateLimitInterceptor.name);
  private readonly store: RateLimitStore = {};
  private readonly cleanupInterval = setInterval(() => this.cleanup(), 60000);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const headers = request.headers || {};
    const headerCandidates: any[] = [
      headers['x-forwarded-for'],
      headers['x-real-ip'],
      headers['cf-connecting-ip'],
      headers['true-client-ip'],
      headers['x-client-ip'],
      headers['x-forwarded'],
      headers['forwarded']
    ];
    const parseHeaderIp = (value: any): string | undefined => {
      if (!value) return undefined;
      const raw = Array.isArray(value) ? value.join(',') : String(value);
      const first = raw.split(',')[0]?.trim();
      return first || undefined;
    };
    const ipFromHeaders = headerCandidates
      .map(parseHeaderIp)
      .find((val: string | undefined) => Boolean(val));
    const ip = ipFromHeaders || request.ip || request.connection?.remoteAddress;
    
    const url = request.url;
    const routePath = request.route?.path;
    const handler = context.getHandler();
    const handlerName = handler.name;
    
    this.logger.debug(`Rate limit check for IP: ${ip}, URL: ${url}, Route: ${routePath}, Handler: ${handlerName}`);
    
    if (this.isLoginRoute(url, routePath, handlerName)) {
      this.logger.debug(`Applying login rate limit for IP: ${ip}`);
      this.checkRateLimit(ip, AUTH_CONSTANTS.LOGIN_RATE_LIMIT, AUTH_CONSTANTS.LOGIN_RATE_LIMIT_WINDOW, 'login'); // 5 attempts per 15 minutes
    } else if (this.isRefreshRoute(url, routePath, handlerName)) {
      this.logger.debug(`Applying refresh rate limit for IP: ${ip}`);
      this.checkRateLimit(ip, AUTH_CONSTANTS.REFRESH_RATE_LIMIT, AUTH_CONSTANTS.REFRESH_RATE_LIMIT_WINDOW, 'token refresh');
    } else if (this.isRegisterRoute(url, routePath, handlerName)) {
      this.logger.debug(`Applying registration rate limit for IP: ${ip}`);
      this.checkRateLimit(ip, AUTH_CONSTANTS.REGISTER_RATE_LIMIT, AUTH_CONSTANTS.REGISTER_RATE_LIMIT_WINDOW, 'registration'); // 3 attempts per hour
    } else if (this.isForgotPasswordRoute(url, routePath, handlerName)) {
      this.logger.debug(`Applying forgot password rate limit for IP: ${ip}`);
      this.checkRateLimit(ip, AUTH_CONSTANTS.FORGOT_PASSWORD_RATE_LIMIT, AUTH_CONSTANTS.FORGOT_PASSWORD_RATE_LIMIT_WINDOW, 'password reset'); // 3 attempts per hour
    } else if (this.isResendVerificationRoute(url, routePath, handlerName)) {
      this.logger.debug(`Applying resend verification rate limit for IP: ${ip}`);
      this.checkRateLimit(ip, AUTH_CONSTANTS.RESEND_VERIFICATION_RATE_LIMIT, AUTH_CONSTANTS.RESEND_VERIFICATION_RATE_LIMIT_WINDOW, 'verification resend'); // 3 attempts per hour
    } else if (this.isVerifyEmailRoute(url, routePath, handlerName)) {
      this.logger.debug(`Applying verify email rate limit for IP: ${ip}`);
      this.checkRateLimit(ip, AUTH_CONSTANTS.VERIFY_EMAIL_RATE_LIMIT, AUTH_CONSTANTS.VERIFY_EMAIL_RATE_LIMIT_WINDOW, 'email verification'); // 5 attempts per hour
    } else if (this.isOAuthRoute(url, routePath, handlerName)) {
      this.logger.debug(`Applying OAuth rate limit for IP: ${ip}`);
      this.checkRateLimit(ip, AUTH_CONSTANTS.OAUTH_RATE_LIMIT, AUTH_CONSTANTS.OAUTH_RATE_LIMIT_WINDOW, 'OAuth'); // 10 attempts per 15 minutes
    }

    return next.handle();
  }

  private isLoginRoute(url: string, routePath?: string, handlerName?: string): boolean {
    const path = this.getPathname(url);
    return /^\/auth\/login(?:\/|$)/.test(path) || 
           routePath === '/auth/login' || 
           handlerName === 'login';
  }

  private isRegisterRoute(url: string, routePath?: string, handlerName?: string): boolean {
    const path = this.getPathname(url);
    return /^\/auth\/register(?:\/|$)/.test(path) || 
           routePath === '/auth/register' || 
           handlerName === 'register';
  }

  private isRefreshRoute(url: string, routePath?: string, handlerName?: string): boolean {
    const path = this.getPathname(url);
    return /^\/auth\/refresh(?:\/|$)/.test(path) ||
           routePath === '/auth/refresh' ||
           handlerName === 'refreshToken';
  }

  private isForgotPasswordRoute(url: string, routePath?: string, handlerName?: string): boolean {
    const path = this.getPathname(url);
    return /^\/auth\/forgot-password(?:\/|$)/.test(path) || 
           routePath === '/auth/forgot-password' || 
           handlerName === 'forgotPassword';
  }

  private isResendVerificationRoute(url: string, routePath?: string, handlerName?: string): boolean {
    const path = this.getPathname(url);
    return /^\/auth\/resend-verification(?:\/|$)/.test(path) || 
           routePath === '/auth/resend-verification' || 
           handlerName === 'resendVerification';
  }

  private isVerifyEmailRoute(url: string, routePath?: string, handlerName?: string): boolean {
    const path = this.getPathname(url);
    return /^\/auth\/verify-email(?:\/|$)/.test(path) || 
           routePath === '/auth/verify-email' || 
           handlerName === 'verifyEmail';
  }

  private isOAuthRoute(url: string, routePath?: string, handlerName?: string): boolean {
    const path = this.getPathname(url);
    return /^\/auth\/oauth\/callback(?:\/|$)/.test(path) || 
           routePath === '/auth/oauth/callback' || 
           handlerName === 'oauthCallback';
  }

  private getPathname(url: string): string {
    if (!url) return '';
    try {
      // Ensure absolute URL for URL parser; request.url may be a path
      const absolute = url.startsWith('http') ? url : `http://localhost${url}`;
      return new URL(absolute).pathname;
    } catch {
      // Fallback: strip query/hash manually
      const withoutQuery = url.split('?')[0];
      return withoutQuery.split('#')[0];
    }
  }

  getRateLimitStatus(ip: string): any {
    const now = Date.now();
    const status: any = { ip, windows: {} };
    
    Object.keys(this.store).forEach(key => {
      if (key.startsWith(ip + ':')) {
        const windowData = this.store[key];
        const windowId = key.split(':')[1];
        const isExpired = windowData.resetTime < now;
        
        status.windows[windowId] = {
          count: windowData.count,
          resetTime: new Date(windowData.resetTime).toISOString(),
          isExpired,
          remainingTime: Math.max(0, Math.ceil((windowData.resetTime - now) / 1000))
        };
      }
    });
    
    return status;
  }

  getRateLimitStats(): any {
    const now = Date.now();
    const totalWindows = Object.keys(this.store).length;
    const activeWindows = Object.values(this.store).filter(w => w.resetTime >= now).length;
    const expiredWindows = totalWindows - activeWindows;
    
    return {
      totalWindows,
      activeWindows,
      expiredWindows,
      totalIPs: new Set(Object.keys(this.store).map(key => key.split(':')[0])).size,
      lastCleanup: new Date(now).toISOString()
    };
  }

  clearRateLimits(ip: string): number {
    const keysToDelete = Object.keys(this.store).filter(key => key.startsWith(ip + ':'));
    keysToDelete.forEach(key => delete this.store[key]);
    this.logger.log(`Cleared ${keysToDelete.length} rate limit entries for IP: ${ip}`);
    return keysToDelete.length;
  }

  clearAllRateLimits(): number {
    const count = Object.keys(this.store).length;
    Object.keys(this.store).forEach(key => delete this.store[key]);
    this.logger.warn(`Cleared all ${count} rate limit entries`);
    return count;
  }

  private checkRateLimit(key: string, maxAttempts: number, windowSeconds: number, action: string): void {
    if (!key || !maxAttempts || !windowSeconds || !action) {
      this.logger.error(`Invalid rate limit parameters: key=${key}, maxAttempts=${maxAttempts}, windowSeconds=${windowSeconds}, action=${action}`);
      return;
    }

    if (maxAttempts <= 0 || windowSeconds <= 0) {
      this.logger.error(`Invalid rate limit values: maxAttempts=${maxAttempts}, windowSeconds=${windowSeconds}`);
      return;
    }

    const now = Date.now();
    const windowSizeMs = windowSeconds * 1000;
    const windowKey = `${key}:${Math.floor(now / windowSizeMs)}`;

    try {
      if (!this.store[windowKey]) {
        this.store[windowKey] = { count: 0, resetTime: now + windowSizeMs };
        this.logger.debug(`Created new rate limit window for ${action}: ${key}, max attempts: ${maxAttempts}, window: ${windowSeconds}s`);
      }

      if (this.store[windowKey].count >= maxAttempts) {
        const remainingTime = Math.ceil((this.store[windowKey].resetTime - now) / 1000);
        this.logger.warn(`Rate limit exceeded for ${action}: ${key}, attempts: ${this.store[windowKey].count}, remaining time: ${remainingTime}s`);
        throw new HttpException(
          `Too many ${action} attempts. Please try again in ${remainingTime} seconds.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      this.store[windowKey].count++;
      this.logger.debug(`Rate limit check for ${action}: ${key}, attempt ${this.store[windowKey].count}/${maxAttempts}`);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Error in rate limit check for ${action}: ${key}`, error);
    }
  }

  private cleanup(): void {
    try {
      const now = Date.now();
      const beforeCount = Object.keys(this.store).length;
      const keysToDelete: string[] = [];
      
      Object.keys(this.store).forEach(key => {
        if (this.store[key].resetTime < now) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => {
        delete this.store[key];
      });
      
      const afterCount = Object.keys(this.store).length;
      if (beforeCount !== afterCount) {
        this.logger.debug(`Cleaned up ${beforeCount - afterCount} expired rate limit entries`);
      }
      
      if (afterCount > 1000) {
        this.logger.warn(`Rate limit store has ${afterCount} entries, consider increasing cleanup frequency`);
      }
    } catch (error) {
      this.logger.error('Error during rate limit cleanup', error);
    }
  }

  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.logger.log('Rate limit interceptor cleanup interval cleared');
    }
  }
}
