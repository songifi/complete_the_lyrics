# JWT Authentication Implementation Test

## Test the implementation

### 1. Register a new user

```bash
curl -X POST http://localhost:3000/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 2. Login to get JWT token

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

Expected response:

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "username": "testuser",
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### 3. Test protected routes with JWT token

#### Get current user info

```bash
curl -X GET http://localhost:3000/users/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

#### Test attempts endpoint

```bash
curl -X GET http://localhost:3000/attempts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

#### Test user stats

```bash
curl -X GET http://localhost:3000/users/my-stats \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

### 4. Test without token (should return 401 Unauthorized)

```bash
curl -X GET http://localhost:3000/users/me
```

## Environment Setup

Make sure to create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Update the values in `.env` as needed, especially:

- `JWT_SECRET`: Use a strong, unique secret in production
- Database credentials

## Setup Instructions

1. Install dependencies:

```bash
pnpm install
```

2. Set up your PostgreSQL database

3. Run the application:

```bash
pnpm run start:dev
```

## Protected Routes Summary

The following routes are now protected with JWT authentication:

- `GET /users/me` - Get current user profile
- `GET /users/stats/:userId` - Get user statistics
- `GET /users/stats/:userId/rank` - Get user rank
- `GET /users/my-stats` - Get current user's statistics
- `GET /attempts` - Get user's attempts
- `POST /attempts` - Create new attempt
- `GET /attempts/my-stats` - Get attempt statistics

## Public Routes

- `POST /users/register` - User registration
- `POST /auth/login` - User login
- `GET /users/leaderboard` - Public leaderboard (optional)

## Custom @CurrentUser() Decorator Usage

```typescript
// Get full user object
@Get('profile')
async getProfile(@CurrentUser() user: User) {
  return user;
}

// Get only user ID
@Get('my-data')
async getMyData(@CurrentUser('id') userId: string) {
  return { userId };
}
```
