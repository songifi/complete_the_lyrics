import { SetMetadata } from '@nestjs/common';
import { ActivityType } from '../entities/room-activity.entity';
import { TRACK_ACTIVITY_KEY, ActivityMetadata } from '../interceptors/activity-logging.interceptor';

/**
 * Decorator to track room activities
 * @param type - The type of activity to track
 * @param options - Additional options for activity tracking
 */
export const TrackActivity = (
  type: ActivityType,
  options?: Partial<Omit<ActivityMetadata, 'type'>>,
) => {
  const metadata: ActivityMetadata = {
    type,
    description: options?.description,
    trackRequest: options?.trackRequest ?? false,
    trackResponse: options?.trackResponse ?? false,
    includeRequestBody: options?.includeRequestBody ?? false,
    includeResponseBody: options?.includeResponseBody ?? false,
  };

  return SetMetadata(TRACK_ACTIVITY_KEY, metadata);
};

/**
 * Decorator for tracking user join activities
 */
export const TrackUserJoined = (description?: string) =>
  TrackActivity(ActivityType.USER_JOINED, {
    description,
    trackRequest: true,
    includeRequestBody: true,
  });

/**
 * Decorator for tracking user leave activities
 */
export const TrackUserLeft = (description?: string) =>
  TrackActivity(ActivityType.USER_LEFT, {
    description,
    trackRequest: true,
  });

/**
 * Decorator for tracking user kick activities
 */
export const TrackUserKicked = (description?: string) =>
  TrackActivity(ActivityType.USER_KICKED, {
    description,
    trackRequest: true,
    includeRequestBody: true,
  });

/**
 * Decorator for tracking user ban activities
 */
export const TrackUserBanned = (description?: string) =>
  TrackActivity(ActivityType.USER_BANNED, {
    description,
    trackRequest: true,
    includeRequestBody: true,
  });

/**
 * Decorator for tracking user mute activities
 */
export const TrackUserMuted = (description?: string) =>
  TrackActivity(ActivityType.USER_MUTED, {
    description,
    trackRequest: true,
    includeRequestBody: true,
  });

/**
 * Decorator for tracking room creation activities
 */
export const TrackRoomCreated = (description?: string) =>
  TrackActivity(ActivityType.ROOM_CREATED, {
    description,
    trackRequest: true,
    includeRequestBody: true,
    trackResponse: true,
  });

/**
 * Decorator for tracking room update activities
 */
export const TrackRoomUpdated = (description?: string) =>
  TrackActivity(ActivityType.ROOM_UPDATED, {
    description,
    trackRequest: true,
    includeRequestBody: true,
  });

/**
 * Decorator for tracking game start activities
 */
export const TrackGameStarted = (description?: string) =>
  TrackActivity(ActivityType.GAME_STARTED, {
    description,
    trackRequest: true,
  });

/**
 * Decorator for tracking game end activities
 */
export const TrackGameEnded = (description?: string) =>
  TrackActivity(ActivityType.GAME_ENDED, {
    description,
    trackRequest: true,
    trackResponse: true,
  });

/**
 * Decorator for tracking custom events
 */
export const TrackCustomEvent = (description?: string, options?: Partial<ActivityMetadata>) =>
  TrackActivity(ActivityType.CUSTOM_EVENT, {
    description,
    ...options,
  });
