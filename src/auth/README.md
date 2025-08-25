# Authentication Service

A comprehensive authentication service built with NestJS that provides secure user registration, login, JWT management, and more.

## Features

### 🔐 Core Authentication
- **User Registration** with email verification
- **Secure Login** with bcrypt password hashing
- **JWT Token Management** with access and refresh tokens
- **Account Lockout** after multiple failed login attempts
- **Remember Me** functionality for extended sessions

### 🔒 Security Features
- **Password Strength Validation** with complexity requirements
- **Rate Limiting** for authentication endpoints
- **Account Lockout** protection against brute force attacks
- **Secure Token Storage** with database-backed refresh tokens
- **IP Address Tracking** for login attempts

### 📧 Email Services
- **Email Verification** for new registrations
- **Password Reset** functionality
- **Welcome Emails** after verification
- **Resend Verification** capability

### 🔄 Token Management
- **Access Token** (15 minutes expiration)
- **Refresh Token** (7 days expiration, 30 days with remember me)
- **Token Revocation** on logout and password changes
- **Automatic Token Refresh** mechanism

### 👤 User Management
- **Profile Updates** (name, username)
- **Password Changes** with current password verification
- **Account Status** tracking
- **OAuth Integration** preparation

## API Endpoints

### Public Endpoints

#### POST `/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "StrongPass123!",
  "firstName": "John",
  "lastName": "Doe",
  "acceptTerms": true
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": false
  }
}
```

#### POST `/auth/login`
Authenticate user and receive tokens.

**Request Body:**
```json
{
  "identifier": "user@example.com",
  "password": "StrongPass123!",
  "rememberMe": false
}
```

**Response:** Same as registration response.

#### POST `/auth/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### POST `/auth/forgot-password`
Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

#### POST `/auth/reset-password`
Reset password using reset token.

**Request Body:**
```json
{
  "token": "reset-token-here",
  "newPassword": "NewStrongPass123!"
}
```

#### POST `/auth/verify-email`
Verify email address with verification token.

**Request Body:**
```json
{
  "token": "verification-token-here"
}
```

#### POST `/auth/resend-verification`
Resend email verification.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

### Protected Endpoints

#### POST `/auth/logout`
Logout user and revoke tokens.

**Headers:** `Authorization: Bearer <access-token>`

#### PUT `/auth/change-password`
Change user password.

**Headers:** `Authorization: Bearer <access-token>`

**Request Body:**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewStrongPass123!"
}
```

#### GET `/auth/profile`
Get user profile information.

**Headers:** `Authorization: Bearer <access-token>`

#### PUT `/auth/profile`
Update user profile.

**Headers:** `Authorization: Bearer <access-token>`

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "username": "newusername"
}
```

#### GET `/auth/health`
Health check endpoint.

## Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this-in-production

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# Email Service Configuration
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Database Entities

#### User Entity
- `id`: UUID primary key
- `email`: Unique email address
- `username`: Unique username
- `password`: Bcrypt hashed password
- `firstName`, `lastName`: Optional name fields
- `isEmailVerified`: Email verification status
- `emailVerificationToken`: Token for email verification
- `emailVerificationExpires`: Expiration for verification token
- `passwordResetToken`: Token for password reset
- `passwordResetExpires`: Expiration for reset token
- `loginAttempts`: Count of failed login attempts
- `lockUntil`: Account lockout expiration
- `isLocked`: Account lockout status
- `isActive`: Account active status
- `lastLoginAt`: Last successful login timestamp
- `lastLoginIp`: Last login IP address
- `oauthProviders`: OAuth account information
- `preferences`: User preferences
- `createdAt`, `updatedAt`: Timestamps

#### RefreshToken Entity
- `id`: UUID primary key
- `token`: JWT refresh token
- `userId`: Reference to user
- `expiresAt`: Token expiration
- `isRevoked`: Token revocation status
- `revokedAt`: Revocation timestamp
- `revokedBy`: Reason for revocation
- `userAgent`: Browser/device information
- `ipAddress`: IP address when token created
- `createdAt`: Creation timestamp

## Security Features

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

### Rate Limiting
- **Login**: 5 attempts per 15 minutes
- **Registration**: 3 attempts per hour
- **Password Reset**: 3 attempts per hour

### Account Lockout
- Account locked after 5 failed login attempts
- Lockout duration: 2 hours
- Automatic unlock after lockout period

### JWT Security
- Access tokens expire in 15 minutes
- Refresh tokens expire in 7 days (30 days with remember me)
- Refresh tokens stored in database for revocation
- Automatic token refresh mechanism

## Usage Examples

### Frontend Integration

#### Login Flow
```typescript
// Login user
const response = await fetch('/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    identifier: 'user@example.com',
    password: 'password123!'
  })
});

const { accessToken, refreshToken, user } = await response.json();

// Store tokens
localStorage.setItem('accessToken', accessToken);
localStorage.setItem('refreshToken', refreshToken);

// Use access token for authenticated requests
const profileResponse = await fetch('/auth/profile', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

#### Token Refresh
```typescript
// Refresh token when access token expires
const refreshResponse = await fetch('/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    refreshToken: localStorage.getItem('refreshToken')
  })
});

const { accessToken: newAccessToken } = await refreshResponse.json();
localStorage.setItem('accessToken', newAccessToken);
```

### Backend Integration

#### Protecting Routes
```typescript
import { JwtAccessGuard } from './auth/guards/jwt-auth.guard';

@Controller('protected')
@UseGuards(JwtAccessGuard)
export class ProtectedController {
  @Get()
  getProtectedData(@CurrentUser() user) {
    return `Hello ${user.username}!`;
  }
}
```

#### Getting Current User
```typescript
import { CurrentUser, CurrentUserId } from './auth/decorators/current-user.decorator';

@Controller('user')
@UseGuards(JwtAccessGuard)
export class UserController {
  @Get('profile')
  getProfile(@CurrentUser() user) {
    return user;
  }

  @Get('id')
  getUserId(@CurrentUserId() userId: string) {
    return { userId };
  }
}
```

## Testing

Run the authentication service tests:

```bash
# Unit tests
npm run test src/auth

# E2E tests
npm run test:e2e
```

## Future Enhancements

### OAuth Integration
- Google OAuth
- Facebook OAuth
- GitHub OAuth
- Twitter OAuth

### Advanced Security
- Two-factor authentication (2FA)
- Biometric authentication
- Device fingerprinting
- Advanced threat detection

### Email Enhancements
- Email templates with dynamic content
- Multiple email providers support
- Email delivery tracking
- Unsubscribe functionality

## Contributing

1. Follow the existing code style
2. Add tests for new functionality
3. Update documentation
4. Ensure security best practices

## License

This project is licensed under the MIT License.
