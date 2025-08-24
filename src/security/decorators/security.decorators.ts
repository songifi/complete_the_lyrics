import { SetMetadata, applyDecorators } from "@nestjs/common";

// Security levels
export enum SecurityLevel {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

// Rate limiting strategies
export enum RateLimitStrategy {
  STRICT = "strict",
  NORMAL = "normal",
  RELAXED = "relaxed",
}

// Security decorator metadata
export const SECURITY_LEVEL_KEY = "security_level";
export const RATE_LIMIT_STRATEGY_KEY = "rate_limit_strategy";
export const REQUIRE_API_KEY_KEY = "require_api_key";
export const IP_WHITELIST_KEY = "ip_whitelist";
export const AUDIT_LOG_KEY = "audit_log";
export const REQUIRED_ROLES_KEY = "required_roles"; // For role-based access control

/**
 * Apply security measures to an endpoint
 */
export function Secure(
  options: {
    level?: SecurityLevel;
    rateLimit?: RateLimitStrategy;
    requireApiKey?: boolean;
    ipWhitelist?: boolean;
    auditLog?: boolean;
  } = {},
) {
  const decorators = [
    SetMetadata(SECURITY_LEVEL_KEY, options.level || SecurityLevel.MEDIUM),
    SetMetadata(
      RATE_LIMIT_STRATEGY_KEY,
      options.rateLimit || RateLimitStrategy.NORMAL,
    ),
    SetMetadata(REQUIRE_API_KEY_KEY, options.requireApiKey || false),
    SetMetadata(IP_WHITELIST_KEY, options.ipWhitelist || false),
    SetMetadata(AUDIT_LOG_KEY, options.auditLog || false),
  ];

  return applyDecorators(...decorators);
}

/**
 * High security endpoint decorator
 */
export function HighSecurity() {
  return Secure({
    level: SecurityLevel.HIGH,
    rateLimit: RateLimitStrategy.STRICT,
    requireApiKey: true,
    auditLog: true,
  });
}

/**
 * Critical security endpoint decorator
 */
export function CriticalSecurity() {
  return Secure({
    level: SecurityLevel.CRITICAL,
    rateLimit: RateLimitStrategy.STRICT,
    requireApiKey: true,
    ipWhitelist: true,
    auditLog: true,
  });
}

/**
 * Admin-only endpoint decorator
 *
 * This decorator applies high security measures AND enforces admin role requirement.
 * Use this for endpoints that should only be accessible by admin users.
 *
 * Security features:
 * - High security level
 * - Strict rate limiting
 * - API key required
 * - Audit logging enabled
 * - Admin role required (enforced by guards)
 */
export function AdminOnly() {
  return applyDecorators(
    Secure({
      level: SecurityLevel.HIGH,
      rateLimit: RateLimitStrategy.STRICT,
      requireApiKey: true,
      auditLog: true,
    }),
    SetMetadata(REQUIRED_ROLES_KEY, ["admin"]),
  );
}

/**
 * Public endpoint decorator (minimal security)
 */
export function PublicEndpoint() {
  return Secure({
    level: SecurityLevel.LOW,
    rateLimit: RateLimitStrategy.RELAXED,
    requireApiKey: false,
    auditLog: false,
  });
}

/**
 * Payment endpoint decorator (high security for financial operations)
 */
export function PaymentEndpoint() {
  return Secure({
    level: SecurityLevel.CRITICAL,
    rateLimit: RateLimitStrategy.STRICT,
    requireApiKey: true,
    auditLog: true,
  });
}
