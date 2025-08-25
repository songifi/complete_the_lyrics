// JWT Secret validation and configuration
const validateJWTSecrets = () => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    if (!process.env.JWT_SECRET) {
      console.error('CRITICAL: JWT_SECRET environment variable is required in production');
      process.exit(1);
    }
    if (!process.env.JWT_REFRESH_SECRET) {
      console.error('CRITICAL: JWT_REFRESH_SECRET environment variable is required in production');
      process.exit(1);
    }
    
    // Validate that secrets are not using default/weak values
    const weakSecrets = [
      'your-super-secret-jwt-key-change-this-in-production',
      'your-super-secret-refresh-key-change-this-in-production',
      'secret',
      'key',
      'password',
      '123456',
      'default'
    ];
    
    if (weakSecrets.includes(process.env.JWT_SECRET) || weakSecrets.includes(process.env.JWT_REFRESH_SECRET)) {
      console.error('CRITICAL: JWT secrets cannot use weak/default values in production');
      process.exit(1);
    }
    
    return {
      JWT_SECRET: process.env.JWT_SECRET,
      JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET
    };
  } else {
    // Development/Non-production: Use environment variables or generate secure temporary values
    const JWT_SECRET = process.env.JWT_SECRET || `dev-secret-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || `dev-refresh-${Date.now()}-${Math.random().toString(36).substring(2)}`;
    
    if (!process.env.JWT_SECRET || !process.env.JWT_REFRESH_SECRET) {
      console.warn('WARNING: Using generated JWT secrets for development. Set JWT_SECRET and JWT_REFRESH_SECRET environment variables for production.');
    }
    
    return { JWT_SECRET, JWT_REFRESH_SECRET };
  }
};

const jwtSecrets = validateJWTSecrets();

export const AUTH_CONSTANTS = {
  // JWT Configuration
  JWT_SECRET: jwtSecrets.JWT_SECRET,
  JWT_REFRESH_SECRET: jwtSecrets.JWT_REFRESH_SECRET,
  
  // Token Expiration Times (in seconds)
  ACCESS_TOKEN_EXPIRES_IN: 15 * 60, // 15 minutes
  REFRESH_TOKEN_EXPIRES_IN: 7 * 24 * 60 * 60, // 7 days
  REMEMBER_ME_EXPIRES_IN: 30 * 24 * 60 * 60, // 30 days
  
  // Email Verification
  EMAIL_VERIFICATION_EXPIRES_IN: 24 * 60 * 60, // 24 hours
  
  // Password Reset
  PASSWORD_RESET_EXPIRES_IN: 1 * 60 * 60, // 1 hour
  
  // Login Security
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 2 * 60 * 60, // 2 hours in seconds
  
  // Rate Limiting
  LOGIN_RATE_LIMIT: 5, // attempts per window
  LOGIN_RATE_LIMIT_WINDOW: 15 * 60, // 15 minutes in seconds
  REGISTER_RATE_LIMIT: 3, // attempts per window
  REGISTER_RATE_LIMIT_WINDOW: 60 * 60, // 1 hour in seconds
  REFRESH_RATE_LIMIT: 20, // attempts per window
  REFRESH_RATE_LIMIT_WINDOW: 15 * 60, // 15 minutes in seconds
  FORGOT_PASSWORD_RATE_LIMIT: 3, // attempts per window
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW: 60 * 60, // 1 hour in seconds
  RESEND_VERIFICATION_RATE_LIMIT: 3, // attempts per window
  RESEND_VERIFICATION_RATE_LIMIT_WINDOW: 60 * 60, // 1 hour in seconds
  VERIFY_EMAIL_RATE_LIMIT: 5, // attempts per window
  VERIFY_EMAIL_RATE_LIMIT_WINDOW: 60 * 60, // 1 hour in seconds
  OAUTH_RATE_LIMIT: 10, // attempts per window
  OAUTH_RATE_LIMIT_WINDOW: 15 * 60, // 15 minutes in seconds
  
  // Password Requirements
  MIN_PASSWORD_LENGTH: 8,
  PASSWORD_REGEX: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
  
  // Bcrypt configuration
  BCRYPT_ROUNDS: 12,
  
  // OAuth Configuration
  OAUTH_PROVIDERS: {
    GOOGLE: 'google',
    FACEBOOK: 'facebook',
    GITHUB: 'github',
    TWITTER: 'twitter',
  },
  
  // Email Templates
  EMAIL_TEMPLATES: {
    VERIFICATION: 'email-verification',
    PASSWORD_RESET: 'password-reset',
    WELCOME: 'welcome',
  },
  
  // Security Headers
  SECURITY_HEADERS: {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
  },
} as const;

export const JWT_STRATEGY = {
  ACCESS: 'jwt-access',
  REFRESH: 'jwt-refresh',
} as const;

export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid credentials',
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User already exists',
  ACCOUNT_LOCKED: 'Account is temporarily locked',
  EMAIL_NOT_VERIFIED: 'Email not verified',
  INVALID_TOKEN: 'Invalid or expired token',
  TOO_MANY_ATTEMPTS: 'Too many login attempts',
  WEAK_PASSWORD: 'Password does not meet security requirements',
  PASSWORDS_DONT_MATCH: 'Passwords do not match',
  INVALID_EMAIL: 'Invalid email address',
  USERNAME_TAKEN: 'Username is already taken',
  EMAIL_TAKEN: 'Email is already registered',
} as const;

export const AUTH_MESSAGES = {
  REGISTRATION_SUCCESS: 'Registration successful. Please check your email to verify your account.',
  LOGIN_SUCCESS: 'Login successful',
  LOGOUT_SUCCESS: 'Logout successful',
  PASSWORD_RESET_SENT: 'Password reset email sent',
  PASSWORD_RESET_SUCCESS: 'Password reset successful',
  EMAIL_VERIFICATION_SENT: 'Verification email sent',
  EMAIL_VERIFICATION_SUCCESS: 'Email verified successfully',
  PROFILE_UPDATED: 'Profile updated successfully',
  PASSWORD_CHANGED: 'Password changed successfully',
} as const;
