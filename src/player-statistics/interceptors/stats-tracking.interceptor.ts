import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler
  } from '@nestjs/common';
  import { Reflector } from '@nestjs/core';
  import { Observable } from 'rxjs';
  import { tap } from 'rxjs/operators';
  import { TRACK_STATS_KEY, StatsTrackingOptions } from '../decorators/track-stats.decorator';
  import { PlayerStatsService } from '../services/player-stats.service';
  
  @Injectable()
  export class StatsTrackingInterceptor implements NestInterceptor {
    constructor(
      private readonly reflector: Reflector,
      private readonly playerStatsService: PlayerStatsService
    ) {}
  
    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
      const trackingOptions = this.reflector.get<StatsTrackingOptions>(
        TRACK_STATS_KEY,
        context.getHandler()
      );
  
      if (!trackingOptions) {
        return next.handle();
      }
  
      const request = context.switchToHttp().getRequest();
      const startTime = Date.now();
  
      return next.handle().pipe(
        tap(async (response) => {
          const endTime = Date.now();
          const duration = endTime - startTime;
  
          // Extract player ID from request
          const playerId = request.user?.id || request.body?.playerId || request.params?.playerId;
          
          if (playerId && trackingOptions.async) {
            // Track stats asynchronously
            setImmediate(() => {
              this.trackMethodStats(playerId, trackingOptions, {
                duration,
                response,
                request
              });
            });
          } else if (playerId) {
            // Track stats synchronously
            await this.trackMethodStats(playerId, trackingOptions, {
              duration,
              response,
              request
            });
          }
        })
      );
    }
  
    private async trackMethodStats(
      playerId: string,
      options: StatsTrackingOptions,
      context: { duration: number; response: any; request: any }
    ) {
      try {
        const metrics = {};
        
        // Extract metrics based on configuration
        options.metrics.forEach(metric => {
          switch (metric) {
            case 'duration':
              metrics[metric] = context.duration;
              break;
            case 'response_size':
              metrics[metric] = JSON.stringify(context.response).length;
              break;
            default:
              if (context.response[metric] !== undefined) {
                metrics[metric] = context.response[metric];
              }
          }
        });
  
        await this.playerStatsService.createPlayerStats({
          playerId,
          category: options.category,
          metrics,
          metadata: {
            method: context.request.method,
            endpoint: context.request.url,
            tracked: true
          }
        });
      } catch (error) {
        console.error('Failed to track method stats:', error);
      }
    }
  }