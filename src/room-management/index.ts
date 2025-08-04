// Room Management System - Public API

// Main module
export * from './room-management.module';

// Entities
export * from './entities';

// Enums and interfaces
export * from './enums';
export * from './interfaces';

// DTOs
export * from './dto';

// Services
export * from './services/room-management.service';
export * from './services/room-moderation.service';
export * from './services/redis-pubsub.service';
export * from './services/room-queue.service';
export * from './services/auth.service';

// Guards
export * from './guards';

// Strategies
export * from './strategies';

// Interceptors
export * from './interceptors';

// Decorators
export * from './decorators';

// Gateways
export * from './gateways';

// Controllers
export * from './controllers/room-management.controller';

// Processors
export * from './processors/room-cleanup.processor';

// Templates and presets
export { default as RoomPresets } from './templates/room-presets.json';

// Activity types
export { ActivityType } from './entities/room-activity.entity';

// Re-export commonly used types for convenience
export type {
  RoomConfiguration,
  RoomMember,
  RoomActivity,
  RoomAnalytics,
  RoomTemplate,
  RoomPreset,
  AuthenticatedRequest,
  AuthenticatedUser,
} from './interfaces';

export type { CreateRoomDto, JoinRoomDto, UpdateRoomDto, RoomQueryDto } from './dto';

export { RoomAccessType, RoomRole, ModerationAction, RoomStatus } from './enums';
