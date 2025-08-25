import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Request } from "express";

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get CORS configuration based on environment
   */
  getCorsConfig() {
    const isProduction = this.configService.get("NODE_ENV") === "production";

    return {
      origin: isProduction
        ? (this.configService.get("ALLOWED_ORIGINS") as string)?.split(",") ||
          []
        : ["http://localhost:3000", "http://localhost:3001"],
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
      maxAge: 86400,
    };
  }

  /**
   * Get Helmet configuration
   * Note: CSP is now handled by dedicated CSP middleware for nonce-based security
   */
  getHelmetConfig() {
    return {
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin" as const },
      crossOriginResourcePolicy: { policy: "cross-origin" as const },
      dnsPrefetchControl: { allow: false },
      frameguard: { action: "deny" as const },
      hidePoweredBy: true,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      ieNoOpen: true,
      noSniff: true,
      permittedCrossDomainPolicies: { permittedPolicies: "none" as const },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" as const },
      xssFilter: true,
    };
  }

  getRateLimitConfig() {
    return {
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: {
        error: "Too many requests from this IP, please try again later.",
        retryAfter: 900,
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      keyGenerator: (req: Request) => {
        let clientIP = "unknown";

        if (req.headers["x-forwarded-for"]) {
          const forwardedFor = req.headers["x-forwarded-for"] as string;
          clientIP = forwardedFor.split(",")[0].trim();
        } else if (req.ip) {
          clientIP = req.ip;
        }

        if (clientIP.startsWith("::ffff:")) {
          clientIP = clientIP.substring(7);
        }

        return clientIP;
      },
    };
  }

  /**
   * Validate API key
   */
  validateApiKey(apiKey: string): boolean {
    const validApiKeys =
      (this.configService.get("VALID_API_KEYS") as string)?.split(",") || [];
    return validApiKeys.includes(apiKey);
  }

  /**
   * Check if request is from allowed IP
   */
  isAllowedIP(ip: string): boolean {
    const allowedIPs =
      (this.configService.get("ALLOWED_IPS") as string)?.split(",") || [];
    return allowedIPs.includes(ip) || allowedIPs.includes("*");
  }

  /**
   * Log security event
   */
  logSecurityEvent(event: string, details: any) {
    this.logger.warn(`Security Event: ${event}`, details);
  }
}
