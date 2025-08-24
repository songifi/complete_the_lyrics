import { Controller, Get, Post, Delete, Body, Param } from "@nestjs/common";
import {
  AdminOnly,
  HighSecurity,
  PublicEndpoint,
} from "../decorators/security.decorators";

/**
 * Example controller demonstrating the use of security decorators
 *
 * This shows the difference between:
 * - @AdminOnly() - High security + admin role required
 * - @HighSecurity() - High security only (no role restriction)
 * - @PublicEndpoint() - Minimal security
 */
@Controller("admin")
export class AdminControllerExample {
  /**
   * Admin-only endpoint - requires admin role AND high security
   *
   * Security features:
   * - High security level
   * - Strict rate limiting
   * - API key required
   * - Audit logging enabled
   * - Admin role required (enforced by RolesGuard)
   */
  @AdminOnly()
  @Get("users")
  getAllUsers() {
    // This endpoint will only be accessible by users with admin role
    // AND will have all high security measures applied
    return { message: "Admin: List of all users" };
  }

  /**
   * Admin-only endpoint for user management
   */
  @AdminOnly()
  @Post("users")
  createUser(@Body() userData: Record<string, unknown>) {
    // Only admins can create users
    return { message: "Admin: User created", data: userData };
  }

  /**
   * Admin-only endpoint for user deletion
   */
  @AdminOnly()
  @Delete("users/:id")
  deleteUser(@Param("id") id: string) {
    // Only admins can delete users
    return { message: "Admin: User deleted", id };
  }

  /**
   * High security endpoint - no role restriction
   *
   * Security features:
   * - High security level
   * - Strict rate limiting
   * - API key required
   * - Audit logging enabled
   * - NO role restriction (any authenticated user can access)
   */
  @HighSecurity()
  @Get("system-status")
  getSystemStatus() {
    // This endpoint has high security but no role restriction
    // Any authenticated user with API key can access
    return { message: "System status", status: "healthy" };
  }

  /**
   * Public endpoint - minimal security
   *
   * Security features:
   * - Low security level
   * - Relaxed rate limiting
   * - No API key required
   * - No audit logging
   * - No authentication required
   */
  @PublicEndpoint()
  @Get("health")
  getHealth() {
    // This endpoint has minimal security
    // Anyone can access without authentication
    return {
      message: "Service is running",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Example of how to set up the module with role enforcement
 *
 * Note: This is just an example - you would integrate this into your actual module
 */
/*
@Module({
  controllers: [AdminControllerExample],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard, // This guard will enforce the @AdminOnly() role requirements
    },
  ],
})
export class AdminModuleExample {}
*/
