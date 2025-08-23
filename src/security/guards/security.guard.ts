import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { SecurityService } from "../security.service";
import {
  SECURITY_LEVEL_KEY,
  RATE_LIMIT_STRATEGY_KEY,
  REQUIRE_API_KEY_KEY,
  IP_WHITELIST_KEY,
  AUDIT_LOG_KEY,
  SecurityLevel,
  RateLimitStrategy,
} from "../decorators/security.decorators";

@Injectable()
export class SecurityGuard implements CanActivate {
  private readonly logger = new Logger(SecurityGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly securityService: SecurityService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const handler = context.getHandler();

    // Get security metadata from decorators (supports both class and method level)
    const securityLevel =
      this.reflector.getAllAndOverride<SecurityLevel>(SECURITY_LEVEL_KEY, [
        handler,
        context.getClass(),
      ]) ?? SecurityLevel.MEDIUM;
    const rateLimitStrategy =
      this.reflector.getAllAndOverride<RateLimitStrategy>(
        RATE_LIMIT_STRATEGY_KEY,
        [handler, context.getClass()],
      ) ?? RateLimitStrategy.NORMAL;
    const requireApiKey =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_API_KEY_KEY, [
        handler,
        context.getClass(),
      ]) ?? false;
    const ipWhitelist =
      this.reflector.getAllAndOverride<boolean>(IP_WHITELIST_KEY, [
        handler,
        context.getClass(),
      ]) ?? false;
    const auditLog =
      this.reflector.getAllAndOverride<boolean>(AUDIT_LOG_KEY, [
        handler,
        context.getClass(),
      ]) ?? false;

    try {
      // Apply security checks based on metadata
      if (requireApiKey) {
        this.validateApiKey(request);
      }

      if (ipWhitelist) {
        this.validateIpWhitelist(request);
      }

      if (auditLog) {
        this.logSecurityEvent(request, "SECURITY_ACCESS", {
          securityLevel,
          rateLimitStrategy,
          requireApiKey,
          ipWhitelist,
        });
      }

      return true;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.warn("Security check failed", {
        path: request.path,
        method: request.method,
        ip: request.ip,
        userAgent: request.get("User-Agent"),
        error: errorMessage,
        securityLevel,
        rateLimitStrategy,
      });

      throw new HttpException(
        {
          error: "Access Denied",
          message: errorMessage,
          statusCode: HttpStatus.FORBIDDEN,
          path: request.path,
          method: request.method,
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private validateApiKey(request: Request): void {
    const apiKey = request.get("X-API-Key");

    if (!apiKey) {
      throw new Error("API key is required for this endpoint");
    }

    if (!this.securityService.validateApiKey(apiKey)) {
      throw new Error("Invalid API key");
    }
  }

  private validateIpWhitelist(request: Request): void {
    const clientIp = request.ip;

    if (!clientIp || !this.securityService.isAllowedIP(clientIp)) {
      throw new Error(
        `IP address ${clientIp || "unknown"} is not allowed to access this endpoint`,
      );
    }
  }

  private logSecurityEvent(
    request: Request,
    event: string,
    details: Record<string, unknown>,
  ): void {
    this.logger.log(`Security event: ${event}`, {
      event,
      path: request.path,
      method: request.method,
      ip: request.ip,
      userAgent: request.get("User-Agent"),
      timestamp: new Date().toISOString(),
      details,
    });
  }
}
