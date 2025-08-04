# Room Management System

A sophisticated, full-featured room management system for multi-user applications with advanced moderation, analytics, and real-time capabilities.

## Features

### Core Functionality

- **Room Creation & Management**: Create rooms with customizable configurations
- **Access Control**: Public, private, and password-protected rooms
- **Capacity Management**: Dynamic room capacity with queuing support
- **Room Templates**: Pre-built room configurations for different use cases

### Moderation System

- **Role-Based Access Control**: Owner, Moderator, Member, Guest roles
- **Moderation Actions**: Kick, Ban, Mute with temporary and permanent options
- **Moderation History**: Complete audit trail of all moderation actions
- **Auto-Moderation**: Automatic expiration of temporary bans and mutes

### Security & Authentication

- **Room-Specific JWT Tokens**: Secure, room-scoped authentication
- **Custom Guards**: Multi-level access control and permission validation
- **Password Protection**: Bcrypt-encrypted room passwords with salt
- **Role Hierarchy**: Enforce moderation permissions based on role levels

### Analytics & Monitoring

- **Room Analytics**: Track member counts, activity, and engagement
- **Activity Logging**: Comprehensive event tracking and history
- **Performance Metrics**: Monitor room usage patterns and trends

### Background Processing

- **Automatic Cleanup**: Remove inactive rooms and expired moderation actions
- **Bull Queues**: Efficient background job processing
- **Scheduled Tasks**: Regular maintenance and analytics updates

## Quick Start

### 1. Install Dependencies

```bash
npm install @nestjs/typeorm @nestjs/bull @nestjs/jwt @nestjs/passport
npm install typeorm bull bcrypt passport passport-jwt
npm install class-validator class-transformer
```

### 2. Import the Module

```typescript
import { Module } from '@nestjs/common';
import { RoomManagementModule } from './room-management';

@Module({
  imports: [
    RoomManagementModule,
    // ... other modules
  ],
})
export class AppModule {}
```

### 3. Environment Configuration

```env
# Database configuration (if not already configured)
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=your_database
DATABASE_USERNAME=your_username
DATABASE_PASSWORD=your_password

# Redis configuration for Bull queues
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Room JWT configuration
ROOM_JWT_SECRET=your-room-jwt-secret
ROOM_JWT_EXPIRES_IN=24h
```

### 4. Database Migration

```bash
# Generate migration
npm run typeorm:generate-migration -- -n RoomManagement

# Run migration
npm run typeorm:migrate
```

## API Endpoints

### Room Management

- `POST /rooms` - Create a new room
- `GET /rooms` - List rooms with filtering and pagination
- `GET /rooms/:id` - Get room details
- `POST /rooms/:id/join` - Join a room
- `POST /rooms/:id/leave` - Leave a room
- `PUT /rooms/:id` - Update room settings
- `DELETE /rooms/:id` - Delete/archive a room

### Moderation

- `POST /rooms/:id/moderation/kick` - Kick a user
- `POST /rooms/:id/moderation/ban` - Ban a user
- `POST /rooms/:id/moderation/mute` - Mute a user
- `POST /rooms/:id/moderation/unban` - Unban a user
- `POST /rooms/:id/moderation/unmute` - Unmute a user
- `GET /rooms/:id/moderation/history` - Get moderation history

## Usage Examples

### Creating a Room

```typescript
const createRoomDto = {
  name: 'My Awesome Room',
  description: 'A fun room for music lovers',
  accessType: RoomAccessType.PUBLIC,
  configuration: {
    maxCapacity: 10,
    isVoiceEnabled: true,
    isVideoEnabled: false,
    allowSpectators: true,
    allowGuestUsers: true,
    moderationSettings: {
      autoModeration: true,
      wordFilter: true,
      linkFilter: false,
      spamProtection: true,
      muteNewUsers: false,
    },
    gameSettings: {
      difficultyLevel: 'medium',
      timeLimit: 45,
      allowHints: true,
      scoreMultiplier: 1.0,
      customRules: {},
    },
  },
};

const { room, token } = await roomService.createRoom(createRoomDto, userId, username);
```

### Joining a Room

```typescript
const joinRoomDto = {
  password: 'room-password', // Only for password-protected rooms
};

const { room, member, token } = await roomService.joinRoom(roomId, joinRoomDto, userId, username);
```

### Moderation Actions

```typescript
// Ban a user for 24 hours
const banUserDto = {
  targetUserId: 'user-to-ban',
  reason: 'Inappropriate behavior',
  duration: 1440, // minutes (24 hours)
};

await moderationService.banUser(roomId, banUserDto, moderatorId, moderatorUsername);
```

## Room Templates

The system includes several pre-built room templates:

- **Beginner Friendly**: Perfect for newcomers with relaxed settings
- **Competitive Arena**: High-stakes environment for serious players
- **Casual Hangout**: Relaxed environment for chatting and casual gameplay
- **Speed Challenge**: Fast-paced rooms for quick thinking
- **Study Group**: Educational environment for learning
- **VIP Lounge**: Exclusive room for premium members

## Guards Usage

### Protecting Routes with Room Access

```typescript
@UseGuards(RoomAccessGuard)
@Get(':id')
async getRoomDetails(@Param('id') roomId: string) {
  // Only users with room access can reach this endpoint
}
```

### Requiring Specific Roles

```typescript
@UseGuards(RoomAccessGuard, RoomModerationGuard)
@RequireRoomRole(RoomRole.MODERATOR)
@Post(':id/moderation/kick')
async kickUser(@Param('id') roomId: string, @Body() kickUserDto: KickUserDto) {
  // Only moderators and above can kick users
}
```

### Custom Permissions

```typescript
@UseGuards(RoomAccessGuard, RoomModerationGuard)
@RequireRoomPermission('manage_settings')
@Put(':id/settings')
async updateSettings(@Param('id') roomId: string, @Body() settings: any) {
  // Only users with 'manage_settings' permission can access
}
```

## Background Jobs

The system automatically handles:

- **Room Activity Monitoring**: Checks for inactive rooms every 6 hours
- **Expired Moderation Cleanup**: Removes expired bans and mutes
- **Analytics Updates**: Regular analytics calculations and updates
- **Archive Cleanup**: Removes old archived rooms after 30 days

## Database Schema

The system uses five main entities:

- **GameRoomEntity**: Main room information with JSON configuration
- **RoomMemberEntity**: User membership and role information
- **RoomActivityEntity**: Activity logging and event tracking
- **RoomTemplateEntity**: Reusable room configuration templates
- **RoomModerationEntity**: Moderation action history and tracking

## Performance Considerations

- Database indexes on frequently queried fields
- Pagination for large result sets
- Background processing for heavy operations
- Efficient SQL queries with proper joins
- Caching support through Redis integration

## Security Features

- JWT-based room authentication with automatic expiration
- Role-based access control with permission validation
- Password encryption using bcrypt with salt rounds
- Input validation and sanitization
- Protection against common attack vectors

## Integration with Other Modules

The room management system is designed to integrate seamlessly with:

- **User Management**: User authentication and profile integration
- **Game Sessions**: Room-based game instances
- **Chat Systems**: Room-scoped messaging
- **Notification Systems**: Event-based notifications
- **Analytics Platforms**: Data export and reporting

## Contributing

When extending the system:

1. Follow the existing pattern of separating concerns (entities, services, controllers)
2. Add comprehensive validation to DTOs
3. Include proper error handling and logging
4. Write unit tests for new functionality
5. Update this documentation

## Support

For issues or questions:

1. Check the existing error logs and debugging information
2. Verify environment configuration
3. Ensure database migrations are up to date
4. Review the API documentation for proper usage patterns
