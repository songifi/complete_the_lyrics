import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  requestId?: string;
  details?: unknown;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);
  private readonly isProduction = process.env.NODE_ENV === "production";

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate unique request ID for tracking
    const requestId = this.generateRequestId();

    // Set security headers
    this.setSecurityHeaders(response);

    // Set request ID header
    response.setHeader("x-request-id", requestId);

    // Determine status code and message
    const status = this.getStatus(exception);
    const message = this.getMessage(exception);
    const details = this.getDetails(exception);

    // Log the exception
    this.logException(exception, request, status, requestId);

    // Format error response
    const errorResponse: ErrorResponse = {
      error: this.getErrorType(status),
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId,
      details: this.sanitizeErrorDetails(details),
    };

    // Send response
    response.status(status).json(errorResponse);
  }

  private getStatus(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private getMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (
        typeof response === "object" &&
        response !== null &&
        "message" in response
      ) {
        return (response as { message?: string }).message || exception.message;
      }
      return exception.message;
    }
    if (exception instanceof Error) {
      return exception.message;
    }
    if (typeof exception === "string") {
      return exception;
    }
    return "Internal Server Error";
  }

  private getDetails(exception: unknown): unknown {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (
        typeof response === "object" &&
        response !== null &&
        "details" in response
      ) {
        return (response as { details?: unknown }).details;
      }
    }
    if (exception instanceof Error) {
      return this.sanitizeStack(exception.stack);
    }
    return undefined;
  }

  /**
   * Sanitizes stack traces based on environment
   * - Production: Returns undefined to prevent PII leakage
   * - Non-production: Returns sanitized stack with sensitive info removed
   */
  private sanitizeStack(stack?: string): string | undefined {
    if (!stack) return undefined;

    // In production, never return stack traces
    if (this.isProduction) {
      return undefined;
    }

    // In non-production, return sanitized stack
    return this.sanitizeStackContent(stack);
  }

  /**
   * Removes sensitive information from stack traces
   * - File paths that might contain user directories
   * - Hostnames and IP addresses
   * - Database connection strings
   * - API keys and secrets
   * - User-specific paths
   */
  private sanitizeStackContent(stack: string): string {
    return (
      stack
        // Remove absolute file paths that might contain user directories
        .replace(/at\s+.*?\([A-Z]:\\.*?\\/g, "at <anonymous>")
        .replace(/at\s+.*?\([/\\].*?[/\\]/g, "at <anonymous>")
        // Remove file paths with line numbers
        .replace(/\([A-Z]:\\.*?:\d+:\d+\)/g, "(<anonymous>)")
        .replace(/\(.*?:\d+:\d+\)/g, "(<anonymous>)")
        // Remove hostnames and IP addresses
        .replace(/\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0|::1)\b/g, "<hostname>")
        .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, "<ip-address>")
        // Remove database connection strings
        .replace(/mongodb:\/\/[^@]*@[^\s]+/g, "mongodb://<credentials>@<host>")
        .replace(
          /postgresql:\/\/[^@]*@[^\s]+/g,
          "postgresql://<credentials>@<host>",
        )
        .replace(/mysql:\/\/[^@]*@[^\s]+/g, "mysql://<credentials>@<host>")
        // Remove API keys and secrets in various formats
        .replace(
          /["']?[a-zA-Z0-9_-]*(?:key|secret|token|password|auth)["']?\s*[:=]\s*["'][^"']*["']/gi,
          "<redacted>",
        )
        // Remove user-specific paths
        .replace(/Users\/[^/]+\//g, "/Users/<username>/")
        .replace(/home\/[^/]+\//g, "/home/<username>/")
        .replace(/C:\\Users\\[^\\]+\\/g, "C:\\Users\\<username>\\")
        // Remove any remaining absolute paths
        .replace(/[A-Z]:\\.*?\\/g, "<path>")
        .replace(/\/.*?\//g, "<path>")
        // Limit stack trace length for security
        .split("\n")
        .slice(0, 10) // Keep only first 10 lines
        .join("\n")
    );
  }

  private getErrorType(statusCode: number): string {
    if (statusCode >= 500) return "Internal Server Error";
    if (statusCode >= 400) return "Client Error";
    if (statusCode >= 300) return "Redirect";
    if (statusCode >= 200) return "Success";
    return "Unknown";
  }

  private sanitizeErrorDetails(details: unknown): unknown {
    if (!details) return details;

    // List of sensitive keys to redact (case-insensitive)
    const sensitiveKeys = [
      "password",
      "token",
      "api_key",
      "api-key",
      "secret",
      "authorization",
      "auth",
      "key",
      "credential",
      "private",
      "sensitive",
      "confidential",
    ];

    try {
      return this.recursivelySanitize(details, sensitiveKeys, new WeakSet(), 0);
    } catch {
      return "[Error details could not be parsed]";
    }
  }

  /**
   * Recursively traverses objects and arrays to redact sensitive values
   * @param value - The value to sanitize
   * @param sensitiveKeys - Array of case-insensitive sensitive key names
   * @param visited - WeakSet to track visited objects for circular reference detection
   * @param depth - Current recursion depth (capped at 10)
   * @returns Sanitized value with original structure preserved
   */
  private recursivelySanitize(
    value: unknown,
    sensitiveKeys: string[],
    visited: WeakSet<object>,
    depth: number,
  ): unknown {
    if (depth > 10) {
      return "[Recursion depth exceeded]";
    }

    if (value === null || value === undefined) {
      return value;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        this.recursivelySanitize(item, sensitiveKeys, visited, depth + 1),
      );
    }

    if (typeof value === "object" && value !== null) {
      if (visited.has(value)) {
        return "[Circular reference detected]";
      }

      visited.add(value);

      const sanitized: Record<string, unknown> = {};

      for (const [key, val] of Object.entries(value)) {
        const isSensitive = sensitiveKeys.some(
          (sensitiveKey) => key.toLowerCase() === sensitiveKey.toLowerCase(),
        );

        if (isSensitive) {
          if (typeof val === "string") {
            sanitized[key] = "[REDACTED]";
          } else if (typeof val === "number") {
            sanitized[key] = "[REDACTED]";
          } else if (typeof val === "boolean") {
            sanitized[key] = "[REDACTED]";
          } else if (val === null) {
            sanitized[key] = "[REDACTED]";
          } else if (val === undefined) {
            sanitized[key] = "[REDACTED]";
          } else {
            sanitized[key] = "[REDACTED]";
          }
        } else {
          sanitized[key] = this.recursivelySanitize(
            val,
            sensitiveKeys,
            visited,
            depth + 1,
          );
        }
      }

      return sanitized;
    }

    return value;
  }

  private setSecurityHeaders(response: Response): void {
    // Security headers
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("X-Frame-Options", "DENY");
    response.setHeader("X-XSS-Protection", "1; mode=block");
    response.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    response.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()",
    );

    // Content Security Policy
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-ancestors 'none';",
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private logException(
    exception: unknown,
    request: Request,
    status: number,
    requestId: string,
  ): void {
    const logData = {
      requestId,
      path: request.url,
      method: request.method,
      statusCode: status,
      ip: request.ip,
      userAgent: request.get("User-Agent"),
      timestamp: new Date().toISOString(),
      exception:
        exception instanceof Error
          ? this.sanitizeStack(exception.stack)
          : String(exception),
    };

    if (status >= 500) {
      this.logger.error("Server Exception", logData);
    } else if (status >= 400) {
      this.logger.warn("Client Exception", logData);
    } else {
      this.logger.log("Exception", logData);
    }
  }
}
