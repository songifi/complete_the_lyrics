package.json (dependencies)

```json
{
  "dependencies": {
    "@nestjs/common": "^10.0.0",
    "@nestjs/core": "^10.0.0",
    "@nestjs/platform-express": "^10.0.0",
    "@nestjs/typeorm": "^10.0.0",
    "@nestjs/swagger": "^7.0.0",
    "@nestjs/config": "^3.0.0",
    "typeorm": "^0.3.17",
    "pg": "^8.11.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.1",
    "uuid": "^9.0.0",
    "swagger-ui-express": "^5.0.0",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/uuid": "^9.0.0",
    "typescript": "^5.0.0"
  }
}
```

## API Endpoints Summary

### Global Leaderboard

- `GET /api/leaderboard/global` - Get global leaderboard with pagination and filtering
- `GET /api/leaderboard/search?q={query}` - Search leaderboard entries

### Friend Leaderboard

- `GET /api/leaderboard/friends/:userId` - Get friend leaderboard for specific user

### Personal Rankings

- `GET /api/leaderboard/personal/:userId` - Get personal ranking details
- `GET /api/leaderboard/user/:userId/rank` - Get user ranks across all leaderboard types

### History

- `GET /api/leaderboard/history/:userId` - Get user's historical rankings
- `GET /api/leaderboard/history` - Get general leaderboard history

### Sharing

- `POST /api/leaderboard/share` - Create shareable leaderboard
- `GET /api/leaderboard/shared/:shareId` - Access shared leaderboard

### Admin/System

- `POST /api/leaderboard/update-score` - Update user scores

## Setup Instructions

1. Install dependencies: `npm install`
2. Set up environment variables in `.env`
3. Run database migrations
4. Start the application: `npm run start:dev`
