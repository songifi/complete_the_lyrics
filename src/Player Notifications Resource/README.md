# NestJS Notification System

A comprehensive notification system built with NestJS featuring multiple delivery channels, real-time notifications, scheduling, analytics, and user preferences.

## Features

### Core Functionality
- ✅ Multiple notification types (Email, Push, SMS, In-App, Webhook)
- ✅ Real-time WebSocket notifications
- ✅ Email templates with Handlebars
- ✅ Firebase Cloud Messaging for push notifications
- ✅ Notification scheduling with Bull Queue
- ✅ User preference management
- ✅ Read status tracking
- ✅ Analytics and engagement metrics
- ✅ Rate limiting and throttling
- ✅ Redis caching for performance
- ✅ Comprehensive error handling and retries

### Technical Features
- ✅ TypeORM with PostgreSQL
- ✅ Custom decorators for notification triggers
- ✅ Interceptors for logging and monitoring
- ✅ Bull Queue for background job processing
- ✅ Redis for caching and session management
- ✅ Comprehensive unit tests
- ✅ Docker containerization
- ✅ Swagger API documentation

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- Docker (optional)

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd nestjs-notification-system
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:
\`\`\`bash
cp .env.example .env
# Edit .env with your configuration
\`\`\`

4. Start the database services:
\`\`\`bash
docker-compose up postgres redis -d
\`\`\`

5. Run database migrations:
\`\`\`bash
npm run migration:run
\`\`\`

6. Start the application:
\`\`\`bash
npm run start:dev
\`\`\`

The API will be available at `http://localhost:3000` and documentation at `http://localhost:3000/api/docs`.

## API Endpoints

### Notifications
- `POST /notifications` - Create a new notification
- `GET /notifications/user/:userId` - Get user notifications
- `GET /notifications/user/:userId/unread-count` - Get unread count
- `PATCH /notifications/:id/read` - Mark as read
- `GET /notifications/analytics` - Get analytics data

### Preferences
- `POST /notifications/preferences` - Create preference
- `GET /notifications/preferences/user/:userId` - Get user preferences
- `PATCH /notifications/preferences/:id` - Update preference
- `DELETE /notifications/preferences/:id` - Delete preference

## Usage Examples

### Creating a Notification
\`\`\`typescript
const notification = await notificationService.create({
  userId: 'user-123',
  type: NotificationType.EMAIL,
  category: NotificationCategory.TRANSACTIONAL,
  title: 'Welcome to our platform!',
  content: 'Thank you for signing up.',
  templateId: 'welcome',
  templateData: {
    name: 'John Doe',
    dashboardUrl: 'https://app.example.com/dashboard'
  }
});
\`\`\`

### Using Notification Decorators
\`\`\`typescript
@Post('users')
@NotificationTrigger({
  type: NotificationType.EMAIL,
  category: NotificationCategory.TRANSACTIONAL,
  template: 'welcome',
  delay: 5000 // 5 seconds delay
})
async createUser(@Body() userData: CreateUserDto) {
  return this.userService.create(userData);
}
\`\`\`

### WebSocket Integration
\`\`\`javascript
// Client-side
const socket = io('http://localhost:3000/notifications');

socket.emit('join', { userId: 'user-123' });

socket.on('notification', (notification) => {
  console.log('New notification:', notification);
  // Update UI with new notification
});
\`\`\`

## Testing

Run the test suite:
\`\`\`bash
# Unit tests
npm run test

# Test coverage
npm run test:cov

# E2E tests
npm run test:e2e
\`\`\`

## Deployment

### Using Docker
\`\`\`bash
# Build and start all services
docker-compose up --build

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
\`\`\`

### Environment Variables
See `.env.example` for all required environment variables.

## Architecture

The system follows a modular architecture with clear separation of concerns:

- **Controllers**: Handle HTTP requests and responses
- **Services**: Business logic and data processing
- **Entities**: Database models with TypeORM
- **Gateways**: WebSocket handling for real-time features
- **Processors**: Background job processing with Bull
- **Decorators**: Custom metadata for notification triggers
- **Interceptors**: Cross-cutting concerns like logging

## Performance Considerations

- Redis caching for user preferences
- Database indexing for optimal query performance
- Bull Queue for asynchronous processing
- Rate limiting to prevent abuse
- Connection pooling for database efficiency

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License.
