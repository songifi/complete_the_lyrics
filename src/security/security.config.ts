import { registerAs } from "@nestjs/config";
import { randomBytes } from "crypto";

export default registerAs("security", () => ({
  // CORS Configuration
  cors: {
    enabled: true,
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:3000",
    ],
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "X-CSRF-Token",
      "Idempotency-Key",
      "X-MFA-Token",
      "Stripe-Signature",
      "X-API-Version",
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  },

  // Rate Limiting Configuration
  rateLimit: {
    enabled: true,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    message: {
      error: "Too many requests from this IP, please try again later.",
      retryAfter: 900, // 15 minutes in seconds
    },
    // Different limits for different endpoints
    limits: {
      auth: { max: 5, windowMs: 15 * 60 * 1000 }, // 5 requests per 15 minutes
      api: { max: 100, windowMs: 15 * 60 * 1000 }, // 100 requests per 15 minutes
      default: { max: 200, windowMs: 15 * 60 * 1000 }, // 200 requests per 15 minutes
    },
    // Redis configuration for distributed rate limiting
    redis: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: "rate_limit:",
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
    },
  },

  // Helmet Security Headers Configuration
  helmet: {
    enabled: true,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"],
        manifestSrc: ["'self'"],
        workerSrc: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: true,
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "same-origin" },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: "deny" },
    hidePoweredBy: true,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    ieNoOpen: true,
    noSniff: true,
    permittedCrossDomainPolicies: { permittedPolicies: "none" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  },

  // Request Validation Configuration
  validation: {
    enabled: true,
    maxBodySize: 10 * 1024 * 1024, // 10MB
    maxDepth: 10,
    allowedContentTypes: [
      "application/json",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "text/plain",
    ],
    // Validation pipe options
    pipe: {
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
      validationError: {
        target: false,
        value: false,
      },
    },
  },

  // Payload Size Limits and Stream Monitoring
  payloadLimits: {
    maxSize: parseInt(process.env.MAX_PAYLOAD_SIZE || "10485760"), // 10MB default
    maxDepth: parseInt(process.env.MAX_DEPTH || "10"),
    maxParameters: parseInt(process.env.MAX_PARAMETERS || "1000"),
    enableStreamMonitoring: process.env.ENABLE_STREAM_MONITORING !== "false",
    abortOnOversize: process.env.ABORT_ON_OVERSIZE !== "false",
    logOversizeAttempts: process.env.LOG_OVERSIZE_ATTEMPTS !== "false",
  },

  // IP Whitelisting and Blacklisting
  ipControl: {
    enabled: process.env.ENABLE_IP_WHITELIST === "true",
    whitelist: process.env.ALLOWED_IPS?.split(",") || [],
    blacklist: process.env.BLOCKED_IPS?.split(",") || [],
    // CIDR notation support
    allowPrivateNetworks: process.env.ALLOW_PRIVATE_NETWORKS === "true",
    allowLocalhost: true,
  },

  // API Key Authentication
  apiKeys: {
    enabled: process.env.ENABLE_API_KEYS === "true",
    validKeys: process.env.VALID_API_KEYS?.split(",") || [],
    headerName: "X-API-Key",
    queryParamName: "api_key",
    requireForSensitiveEndpoints: true,
  },

  // Session Security
  session: {
    secret: (() => {
      const sessionSecret = process.env.SESSION_SECRET;

      if (!sessionSecret) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            "SESSION_SECRET environment variable is required in production. " +
              "Please set a secure, random secret with at least 32 characters. " +
              "Application startup aborted for security reasons.",
          );
        } else {
          // Generate a cryptographically strong random secret for development
          const tempSecret = randomBytes(32).toString("hex");
          console.warn(
            "WARNING: SESSION_SECRET not set. Using temporary cryptographically strong secret. " +
              "Set SESSION_SECRET environment variable for production use.",
          );
          return tempSecret;
        }
      }

      // Validate secret length in production
      if (process.env.NODE_ENV === "production" && sessionSecret.length < 32) {
        throw new Error(
          "SESSION_SECRET must be at least 32 characters long in production. " +
            "Current length: " +
            sessionSecret.length +
            " characters. " +
            "Application startup aborted for security reasons.",
        );
      }

      return sessionSecret;
    })(),
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },

  // CSRF Protection
  // NOTE: CSRF_SECRET environment variable MUST be set in production.
  // The application will not start in production without this secret.
  csrf: {
    enabled: true,
    secret: (() => {
      const csrfSecret = process.env.CSRF_SECRET;
      if (!csrfSecret) {
        if (process.env.NODE_ENV === "production") {
          throw new Error(
            "CSRF_SECRET environment variable is required in production. " +
              "Please set a secure, random secret value. " +
              "Application startup aborted for security reasons.",
          );
        } else {
          console.warn(
            "⚠️  WARNING: CSRF_SECRET not set. Using development fallback. " +
              "Set CSRF_SECRET environment variable for production use.",
          );
          return "dev-csrf-secret-not-for-production";
        }
      }
      return csrfSecret;
    })(),
    tokenLength: 32,
    ignoreMethods: ["GET", "HEAD", "OPTIONS"],
  },

  // Logging and Monitoring
  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableRequestLogging: true,
    enableSecurityLogging: true,
    logSensitiveData: false,
    logRateLimitViolations: true,
    logFailedAuthAttempts: true,
    logOversizeRequests: true,
  },

  // Error Handling
  errorHandling: {
    enableDetailedErrors: process.env.NODE_ENV !== "production",
    logAllErrors: true,
    sanitizeErrorDetails: true,
    includeStackTraces: process.env.NODE_ENV !== "production",
    errorResponseFormat: {
      timestamp: true,
      path: true,
      method: true,
      requestId: true,
      errorCode: true,
    },
  },

  // API Versioning
  apiVersioning: {
    enabled: true,
    defaultVersion: "v1",
    supportedVersions: ["v1"],
    versionHeader: "X-API-Version",
    versionQueryParam: "version",
    strictVersioning: false,
    deprecatedVersions: [],
  },

  // Security Headers
  headers: {
    xContentTypeOptions: "nosniff",
    xFrameOptions: "DENY",
    xXSSProtection: "1; mode=block",
    referrerPolicy: "strict-origin-when-cross-origin",
    permissionsPolicy: "geolocation=(), microphone=(), camera=()",
    contentSecurityPolicy: true,
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  },

  // Request Sanitization
  sanitization: {
    enabled: true,
    removeNullBytes: true,
    removeControlCharacters: true,
    maxStringLength: 10000,
    allowedHtmlTags: [],
    sanitizeUserInput: true,
  },

  // Brute Force Protection
  bruteForce: {
    enabled: true,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    blockDuration: 30 * 60 * 1000, // 30 minutes
    trackBy: "ip", // ip, user, or both
  },

  // SQL Injection Protection
  sqlInjection: {
    enabled: true,
    blockPatterns: [
      /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i,
      /(\b(script|javascript|vbscript|onload|onerror)\b)/i,
      /(\b(union\s+select|select\s+union)\b)/i,
    ],
    logAttempts: true,
    blockAttempts: true,
  },

  // XSS Protection
  xss: {
    enabled: true,
    mode: "block",
    reportUri: null,
    blockPatterns: [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
    ],
  },
}));
