import {
  Secure,
  AdminOnly,
  HighSecurity,
  CriticalSecurity,
  PublicEndpoint,
  SecurityLevel,
  RateLimitStrategy,
  SECURITY_LEVEL_KEY,
  RATE_LIMIT_STRATEGY_KEY,
  REQUIRE_API_KEY_KEY,
  IP_WHITELIST_KEY,
  AUDIT_LOG_KEY,
  REQUIRED_ROLES_KEY,
} from "./security.decorators";

describe("Security Decorators", () => {
  describe("Secure", () => {
    it("should apply default security settings when no options provided", () => {
      const result = Secure();

      // Check that the decorator returns an array of SetMetadata calls
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(5);

      // Verify default values are set
      const metadata = extractMetadata(result);
      expect(metadata[SECURITY_LEVEL_KEY]).toBe(SecurityLevel.MEDIUM);
      expect(metadata[RATE_LIMIT_STRATEGY_KEY]).toBe(RateLimitStrategy.NORMAL);
      expect(metadata[REQUIRE_API_KEY_KEY]).toBe(false);
      expect(metadata[IP_WHITELIST_KEY]).toBe(false);
      expect(metadata[AUDIT_LOG_KEY]).toBe(false);
    });

    it("should apply custom security settings when options provided", () => {
      const result = Secure({
        level: SecurityLevel.HIGH,
        rateLimit: RateLimitStrategy.STRICT,
        requireApiKey: true,
        ipWhitelist: true,
        auditLog: true,
      });

      const metadata = extractMetadata(result);
      expect(metadata[SECURITY_LEVEL_KEY]).toBe(SecurityLevel.HIGH);
      expect(metadata[RATE_LIMIT_STRATEGY_KEY]).toBe(RateLimitStrategy.STRICT);
      expect(metadata[REQUIRE_API_KEY_KEY]).toBe(true);
      expect(metadata[IP_WHITELIST_KEY]).toBe(true);
      expect(metadata[AUDIT_LOG_KEY]).toBe(true);
    });
  });

  describe("HighSecurity", () => {
    it("should apply high security settings", () => {
      const result = HighSecurity();

      const metadata = extractMetadata(result);
      expect(metadata[SECURITY_LEVEL_KEY]).toBe(SecurityLevel.HIGH);
      expect(metadata[RATE_LIMIT_STRATEGY_KEY]).toBe(RateLimitStrategy.STRICT);
      expect(metadata[REQUIRE_API_KEY_KEY]).toBe(true);
      expect(metadata[IP_WHITELIST_KEY]).toBe(false);
      expect(metadata[AUDIT_LOG_KEY]).toBe(true);
    });
  });

  describe("CriticalSecurity", () => {
    it("should apply critical security settings", () => {
      const result = CriticalSecurity();

      const metadata = extractMetadata(result);
      expect(metadata[SECURITY_LEVEL_KEY]).toBe(SecurityLevel.CRITICAL);
      expect(metadata[RATE_LIMIT_STRATEGY_KEY]).toBe(RateLimitStrategy.STRICT);
      expect(metadata[REQUIRE_API_KEY_KEY]).toBe(true);
      expect(metadata[IP_WHITELIST_KEY]).toBe(true);
      expect(metadata[AUDIT_LOG_KEY]).toBe(true);
    });
  });

  describe("AdminOnly", () => {
    it("should apply high security settings AND admin role requirement", () => {
      const result = AdminOnly();

      // Should return an array of decorators (Secure + SetMetadata for roles)
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);

      // First decorator should be Secure with high security
      const secureMetadata = extractMetadata(result[0]);
      expect(secureMetadata[SECURITY_LEVEL_KEY]).toBe(SecurityLevel.HIGH);
      expect(secureMetadata[RATE_LIMIT_STRATEGY_KEY]).toBe(
        RateLimitStrategy.STRICT,
      );
      expect(secureMetadata[REQUIRE_API_KEY_KEY]).toBe(true);
      expect(secureMetadata[IP_WHITELIST_KEY]).toBe(false);
      expect(secureMetadata[AUDIT_LOG_KEY]).toBe(true);

      // Second decorator should set admin role requirement
      const roleMetadata = extractMetadata(result[1]);
      expect(roleMetadata[REQUIRED_ROLES_KEY]).toEqual(["admin"]);
    });

    it("should be different from HighSecurity (should include role requirement)", () => {
      const adminResult = AdminOnly();
      const highSecurityResult = HighSecurity();

      // AdminOnly should have more decorators (Secure + Roles)
      expect(adminResult.length).toBeGreaterThan(highSecurityResult.length);

      // AdminOnly should include role metadata
      const adminMetadata = extractMetadata(adminResult);
      expect(adminMetadata[REQUIRED_ROLES_KEY]).toEqual(["admin"]);

      // HighSecurity should not include role metadata
      const highSecurityMetadata = extractMetadata(highSecurityResult);
      expect(highSecurityMetadata[REQUIRED_ROLES_KEY]).toBeUndefined();
    });
  });

  describe("PublicEndpoint", () => {
    it("should apply minimal security settings", () => {
      const result = PublicEndpoint();

      const metadata = extractMetadata(result);
      expect(metadata[SECURITY_LEVEL_KEY]).toBe(SecurityLevel.LOW);
      expect(metadata[RATE_LIMIT_STRATEGY_KEY]).toBe(RateLimitStrategy.RELAXED);
      expect(metadata[REQUIRE_API_KEY_KEY]).toBe(false);
      expect(metadata[IP_WHITELIST_KEY]).toBe(false);
      expect(metadata[AUDIT_LOG_KEY]).toBe(false);
    });
  });
});

/**
 * Helper function to extract metadata from decorator results
 * This simulates what happens when the decorators are actually applied
 */
function extractMetadata(decorators: unknown): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};

  if (Array.isArray(decorators)) {
    // Handle array of decorators (like from applyDecorators)
    decorators.forEach((decorator) => {
      if (
        decorator &&
        typeof decorator === "function" &&
        (decorator as { name?: string }).name === "SetMetadata"
      ) {
        // Simulate SetMetadata behavior
        const key = (decorator as { toString(): string })
          .toString()
          .match(/SetMetadata\(([^,]+)/)?.[1];
        const value = (decorator as { toString(): string })
          .toString()
          .match(/,\s*([^)]+)\)/)?.[1];
        if (key && value) {
          try {
            // Clean up the extracted values
            const cleanKey = key.replace(/['"]/g, "").trim();
            const cleanValue = eval(value) as unknown; // Safe in test context
            metadata[cleanKey] = cleanValue;
          } catch {
            // Ignore parsing errors for test purposes
          }
        }
      }
    });
  }

  return metadata;
}
