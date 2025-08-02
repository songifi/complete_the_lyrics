import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { RoomActivityEntity, ActivityType } from '../entities/room-activity.entity';
import { AuthenticatedUser } from '../interfaces';
import { RedisPubSubService } from '../services/redis-pubsub.service';

export const TRACK_ACTIVITY_KEY = 'track_activity';
export const ACTIVITY_TYPE_KEY = 'activity_type';
export const ACTIVITY_DESCRIPTION_KEY = 'activity_description';

export interface ActivityMetadata {
  type: ActivityType;
  description?: string;
  trackRequest?: boolean;
  trackResponse?: boolean;
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
}

@Injectable()
export class ActivityLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggingInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(RoomActivityEntity)
    private readonly activityRepository: Repository<RoomActivityEntity>,
    private readonly pubSubService: RedisPubSubService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const activityMetadata = this.reflector.getAllAndOverride<ActivityMetadata>(
      TRACK_ACTIVITY_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!activityMetadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;
    const roomId = this.extractRoomId(request);
    const startTime = Date.now();

    if (!roomId) {
      // Skip logging if no room context
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: (response: unknown) => {
          // Use void operator to handle async operation properly
          void this.logActivity({
            activityMetadata,
            request,
            response,
            user,
            roomId,
            executionTime: Date.now() - startTime,
            success: true,
          }).catch((error) => {
            this.logger.error('Failed to log successful activity:', error);
          });
        },
        error: (error: Error) => {
          // Use void operator to handle async operation properly
          void this.logActivity({
            activityMetadata,
            request,
            response: null,
            user,
            roomId,
            executionTime: Date.now() - startTime,
            success: false,
            error: error.message || 'Unknown error',
          }).catch((logError) => {
            this.logger.error('Failed to log error activity:', logError);
          });
        },
      }),
    );
  }

  private extractRoomId(request: Request): string | null {
    // Try to get room ID from various sources
    const params = request.params as Record<string, string>;
    if (params?.id) {
      return params.id;
    }
    if (params?.roomId) {
      return params.roomId;
    }
    const body = request.body as Record<string, unknown>;
    if (body?.roomId) {
      return body.roomId as string;
    }
    const query = request.query as Record<string, string>;
    if (query?.roomId) {
      return query.roomId;
    }
    return null;
  }

  private async logActivity(options: {
    activityMetadata: ActivityMetadata;
    request: Request & { user?: AuthenticatedUser };
    response: unknown;
    user?: AuthenticatedUser;
    roomId: string;
    executionTime: number;
    success: boolean;
    error?: string;
  }) {
    const { activityMetadata, request, response, user, roomId, executionTime, success, error } =
      options;

    const metadata: Record<string, unknown> = {
      method: request.method,
      url: request.url,
      userAgent: request.get('User-Agent'),
      ip: request.ip || (request.socket?.remoteAddress as string),
      executionTime,
      success,
    };

    if (error) {
      metadata.error = error;
    }

    if (activityMetadata.trackRequest || activityMetadata.includeRequestBody) {
      metadata.request = {
        headers: activityMetadata.trackRequest ? request.headers : undefined,
        body: activityMetadata.includeRequestBody ? request.body : undefined,
        query: request.query,
        params: request.params,
      } as Record<string, unknown>;
    }

    if (
      success &&
      response &&
      (activityMetadata.trackResponse || activityMetadata.includeResponseBody)
    ) {
      const responseObj = response as Record<string, unknown>;
      metadata.response = {
        statusCode: responseObj?.statusCode,
        body: activityMetadata.includeResponseBody ? response : undefined,
      };
    }

    // Determine target user from request body for moderation actions
    let targetUserId: string | undefined;
    let targetUsername: string | undefined;

    const body = request.body as Record<string, unknown>;
    if (body?.targetUserId || body?.userId) {
      targetUserId = (body.targetUserId || body.userId) as string;
    }
    if (body?.targetUsername || body?.username) {
      targetUsername = (body.targetUsername || body.username) as string;
    }

    const activity = this.activityRepository.create({
      roomId,
      activityType: activityMetadata.type,
      userId: user?.id,
      username: user?.username,
      targetUserId,
      targetUsername,
      description:
        activityMetadata.description || this.generateDescription(activityMetadata.type, request),
      metadata,
      ipAddress: request.ip || (request.socket?.remoteAddress as string),
      userAgent: request.get('User-Agent'),
    });

    try {
      const savedActivity = await this.activityRepository.save(activity);

      // Publish activity to Redis for real-time updates
      await this.pubSubService.publishRoomEvent(roomId, {
        type: 'activity',
        roomId,
        userId: user?.id,
        username: user?.username,
        data: {
          activityType: activityMetadata.type,
          description: savedActivity.description,
          success,
          executionTime,
        },
        timestamp: savedActivity.createdAt,
      });

      this.logger.debug(
        `Activity logged: ${activityMetadata.type} by ${user?.username || 'unknown'} in room ${roomId}`,
      );
    } catch (error) {
      this.logger.error('Failed to save activity to database:', error);
    }
  }

  private generateDescription(activityType: ActivityType, request: Request): string {
    const method = request.method;
    const path = (request as { route?: { path?: string } }).route?.path || request.url;

    switch (activityType) {
      case ActivityType.USER_JOINED:
        return `User joined the room`;
      case ActivityType.USER_LEFT:
        return `User left the room`;
      case ActivityType.USER_KICKED:
        return `User was kicked from the room`;
      case ActivityType.USER_BANNED:
        return `User was banned from the room`;
      case ActivityType.USER_MUTED:
        return `User was muted in the room`;
      case ActivityType.USER_PROMOTED:
        return `User role was promoted`;
      case ActivityType.USER_DEMOTED:
        return `User role was demoted`;
      case ActivityType.ROOM_CREATED:
        return `Room was created`;
      case ActivityType.ROOM_UPDATED:
        return `Room settings were updated`;
      case ActivityType.ROOM_LOCKED:
        return `Room was locked`;
      case ActivityType.ROOM_UNLOCKED:
        return `Room was unlocked`;
      case ActivityType.MESSAGE_SENT:
        return `Message sent in room`;
      case ActivityType.GAME_STARTED:
        return `Game started in room`;
      case ActivityType.GAME_ENDED:
        return `Game ended in room`;
      case ActivityType.CUSTOM_EVENT:
        return `Custom event: ${method} ${path}`;
      default:
        return `Activity: ${method} ${path}`;
    }
  }
}
