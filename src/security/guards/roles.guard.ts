import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_ROLES_KEY } from "../decorators/security.decorators";

/**
 * Guard that enforces role-based access control based on metadata
 *
 * This guard reads the REQUIRED_ROLES_KEY metadata set by decorators like @AdminOnly()
 * and checks if the current user has the required roles.
 *
 * Usage:
 * 1. Apply @AdminOnly() to your endpoint
 * 2. Add this guard to your module/controller
 * 3. Implement user role checking logic in canActivate()
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      REQUIRED_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, allow access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: { roles?: string[] } }>();
    const user = request.user; // Assuming user is attached by auth middleware

    // TODO: Implement your user role checking logic here
    // This is a placeholder - replace with your actual role checking
    if (!user) {
      return false; // No user authenticated
    }

    // Example: Check if user has any of the required roles
    const userRoles = user.roles || [];
    const hasRequiredRole = requiredRoles.some((role) =>
      userRoles.includes(role),
    );

    return hasRequiredRole;
  }
}
