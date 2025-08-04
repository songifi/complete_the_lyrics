import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TournamentCacheService } from '../services/tournament-cache.service';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(private readonly cacheService: TournamentCacheService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const cacheKey = this.generateCacheKey(request);

    // Only cache GET requests
    if (request.method !== 'GET') {
      return next.handle();
    }

    try {
      // Try to get cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        return of(cachedResponse);
      }

      // Execute request and cache response
      return next.handle().pipe(
        tap(async (response) => {
          await this.setCachedResponse(cacheKey, response);
        }),
      );
    } catch (error) {
      // If cache fails, continue with request
      return next.handle();
    }
  }

  private generateCacheKey(request: any): string {
    const { method, url, query, params } = request;
    const userId = request.user?.id || 'anonymous';

    return `cache:${method}:${url}:${userId}:${JSON.stringify(query)}:${JSON.stringify(params)}`;
  }

  private async getCachedResponse(key: string): Promise<any | null> {
    // Implementation would use the cache service
    // For now, return null to skip caching
    return null;
  }

  private async setCachedResponse(key: string, response: any): Promise<void> {
    // Implementation would use the cache service
    // For now, do nothing
  }
}
