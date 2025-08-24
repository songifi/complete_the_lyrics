import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

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

@Injectable()
export class ErrorHandlingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorHandlingMiddleware.name);

  use(req: Request, res: Response, next: NextFunction) {
    // Generate unique request ID for tracking
    const requestId = this.generateRequestId();
    req.requestId = requestId;

    // Set the header for client responses if needed
    res.setHeader("x-request-id", requestId);

    // Override response methods to catch errors
    const originalSend = res.send.bind(res) as (data: unknown) => Response;
    const originalJson = res.json.bind(res) as (data: unknown) => Response;
    const originalEnd = res.end.bind(res) as (data?: unknown) => Response;

    // Intercept send method
    res.send = (data: unknown) => {
      try {
        if (res.statusCode >= 400) {
          this.logErrorResponse(req, res, data, requestId);
        }
        return originalSend(data);
      } catch (error) {
        this.logErrorResponse(req, res, error, requestId);
        return originalSend(this.formatError(error, req, requestId));
      }
    };

    // Intercept json method
    res.json = (data: unknown) => {
      try {
        if (res.statusCode >= 400) {
          this.logErrorResponse(req, res, data, requestId);
        }
        return originalJson(data);
      } catch (error) {
        this.logErrorResponse(req, res, error, requestId);
        return originalJson(this.formatError(error, req, requestId));
      }
    };

    // Intercept end method
    res.end = (data?: unknown) => {
      try {
        if (res.statusCode >= 400) {
          this.logErrorResponse(req, res, data, requestId);
        }
        return originalEnd(data);
      } catch (error) {
        this.logErrorResponse(req, res, error, requestId);
        return originalEnd(this.formatError(error, req, requestId));
      }
    };

    // Note: Global error handling is handled by NestJS exception filters
    // This middleware focuses on response interception

    next();
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private formatError(
    error: unknown,
    req: Request,
    requestId: string,
  ): ErrorResponse {
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorMessage = "Internal Server Error";
    let details: unknown = undefined;

    if (error instanceof HttpException) {
      statusCode = error.getStatus();
      const response = error.getResponse();
      if (
        typeof response === "object" &&
        response !== null &&
        "message" in response
      ) {
        errorMessage =
          (response as { message?: string }).message || error.message;
        details = (response as { details?: unknown }).details;
      } else {
        errorMessage = error.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
      details = error.stack;
    } else if (typeof error === "string") {
      errorMessage = error;
    }

    // Sanitize sensitive information
    const sanitizedDetails = this.sanitizeErrorDetails(details);

    return {
      error: this.getErrorType(statusCode),
      message: errorMessage,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
      method: req.method,
      requestId,
      details: sanitizedDetails,
    };
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

    try {
      const detailsStr = JSON.stringify(details);

      // Remove sensitive information
      const sanitized = detailsStr
        .replace(
          /password["\s]*:["\s]*["'][^"']*["']/gi,
          'password: "[REDACTED]"',
        )
        .replace(/token["\s]*:["\s]*["'][^"']*["']/gi, 'token: "[REDACTED]"')
        .replace(
          /api[_-]?key["\s]*:["\s]*["'][^"']*["']/gi,
          'api_key: "[REDACTED]"',
        )
        .replace(/secret["\s]*:["\s]*["'][^"']*["']/gi, 'secret: "[REDACTED]"')
        .replace(
          /authorization["\s]*:["\s]*["'][^"']*["']/gi,
          'authorization: "[REDACTED]"',
        );

      return JSON.parse(sanitized);
    } catch {
      return "[Error details could not be parsed]";
    }
  }

  private logErrorResponse(
    req: Request,
    res: Response,
    data: unknown,
    requestId: string,
  ) {
    const logData = {
      requestId,
      path: req.path,
      method: req.method,
      statusCode: res.statusCode,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      timestamp: new Date().toISOString(),
      error: data,
    };

    if (res.statusCode >= 500) {
      this.logger.error("Server Error Response", logData);
    } else if (res.statusCode >= 400) {
      this.logger.warn("Client Error Response", logData);
    }
  }
}
