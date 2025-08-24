import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

export interface LoggingMiddlewareOptions {
  /** Enable logging of full response body (default: false) */
  enableBodyLogging?: boolean;
  /** Maximum length for logged strings (default: 1000) */
  maxLogLength?: number;
  /** Fields to include in error logs when body logging is disabled (default: ['message', 'code', 'status']) */
  safeErrorFields?: string[];
}

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(LoggingMiddleware.name);
  private readonly options: Required<LoggingMiddlewareOptions>;

  constructor(options: LoggingMiddlewareOptions = {}) {
    this.options = {
      enableBodyLogging: false,
      maxLogLength: 1000,
      safeErrorFields: ["message", "code", "status"],
      ...options,
    };
  }

  /**
   * Sanitizes sensitive data from strings
   */
  private sanitizeString(input: string): string {
    if (!input || typeof input !== "string") return input;

    let sanitized = input;

    // Remove or mask common sensitive patterns
    sanitized = sanitized
      // Email addresses
      .replace(
        /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        "[EMAIL]",
      )
      // SSNs (XXX-XX-XXXX format)
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[SSN]")
      // Credit card numbers (16-19 digits, possibly with spaces/dashes)
      .replace(/\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, "[CREDIT_CARD]")
      // Authorization tokens (Bearer, Basic, etc.)
      .replace(/(Bearer|Basic|Token)\s+[A-Za-z0-9._-]+/gi, "$1 [TOKEN]")
      // API keys (common patterns)
      .replace(/\b[A-Za-z0-9]{32,}\b/g, "[API_KEY]");

    return sanitized;
  }

  /**
   * Truncates and sanitizes content for logging
   */
  private prepareLogContent(content: unknown): unknown {
    if (content === null || content === undefined) {
      return content;
    }

    if (typeof content === "string") {
      const sanitized = this.sanitizeString(content);
      return sanitized.length > this.options.maxLogLength
        ? sanitized.substring(0, this.options.maxLogLength) + "..."
        : sanitized;
    }

    if (typeof Buffer !== "undefined" && Buffer.isBuffer(content)) {
      const stringContent = content.toString("utf8");
      const sanitized = this.sanitizeString(stringContent);
      return sanitized.length > this.options.maxLogLength
        ? sanitized.substring(0, this.options.maxLogLength) + "..."
        : sanitized;
    }

    if (typeof content === "object") {
      try {
        const stringified = JSON.stringify(content);
        const sanitized = this.sanitizeString(stringified);
        return sanitized.length > this.options.maxLogLength
          ? sanitized.substring(0, this.options.maxLogLength) + "..."
          : sanitized;
      } catch {
        return "[unserializable object]";
      }
    }

    if (typeof content === "number" || typeof content === "boolean") {
      return `${content}`;
    }

    if (typeof content === "symbol") {
      return content.toString();
    }

    if (typeof content === "function") {
      return "[function]";
    }

    return "[unknown]";
  }

  /**
   * Extracts safe error information from response content
   * Prevents prototype pollution by only accepting plain objects and safe values
   */
  private extractSafeErrorInfo(content: unknown): Record<string, unknown> {
    if (!content) return {};

    let errorObj: Record<string, unknown> = {};

    if (typeof content === "string") {
      try {
        const parsed = JSON.parse(content) as unknown;
        // Verify it's a plain object, not array/null
        if (this.isPlainObject(parsed)) {
          errorObj = parsed;
        } else {
          // If not a plain object, treat as plain text
          errorObj = { message: content };
        }
      } catch {
        // If not JSON, treat as plain text
        errorObj = { message: content };
      }
    } else if (this.isPlainObject(content)) {
      errorObj = content;
    }

    // Extract only safe fields with security checks
    const safeInfo: Record<string, unknown> = {};
    for (const field of this.options.safeErrorFields) {
      // Skip dangerous prototype pollution keys
      if (this.isDangerousKey(field)) {
        continue;
      }

      // Use safe property checking
      if (Object.prototype.hasOwnProperty.call(errorObj, field)) {
        const value = errorObj[field];
        // Only copy primitive or safe serializable values
        if (this.isSafeValue(value)) {
          safeInfo[field] = value;
        }
      }
    }

    return safeInfo;
  }

  /**
   * Checks if an object is a plain object (not array, null, or custom prototype)
   */
  private isPlainObject(obj: unknown): obj is Record<string, unknown> {
    if (!obj || typeof obj !== "object") return false;
    if (Array.isArray(obj)) return false;
    return Object.getPrototypeOf(obj) === Object.prototype;
  }

  /**
   * Checks if a key is potentially dangerous for prototype pollution
   */
  private isDangerousKey(key: string): boolean {
    const dangerousKeys = ["__proto__", "constructor", "prototype"];
    return dangerousKeys.includes(key);
  }

  /**
   * Checks if a value is safe to serialize (primitive or safe object)
   */
  private isSafeValue(value: unknown): boolean {
    if (value === null) return true;
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return true;
    }
    if (typeof value === "object") {
      // Only allow plain objects, not arrays or objects with custom prototypes
      return this.isPlainObject(value);
    }
    return false;
  }

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers["user-agent"] || "Unknown";

    // Log incoming request
    this.logger.log(`Incoming ${method} request to ${originalUrl}`, {
      method,
      url: originalUrl,
      ip,
      userAgent,
      timestamp: new Date().toISOString(),
      headers: {
        "content-type": headers["content-type"],
        authorization: headers["authorization"] ? "***" : undefined,
        "x-api-key": headers["x-api-key"] ? "***" : undefined,
      },
    });

    // Override res.end to log response
    const originalEnd = res.end.bind(res) as Response["end"];
    (res.end as any) = (
      chunk?: any,
      encoding?: BufferEncoding,
      cb?: () => void,
    ): Response => {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Log response
      this.logger.log(`Response for ${method} ${originalUrl}`, {
        method,
        url: originalUrl,
        statusCode,
        duration: `${duration}ms`,
        ip,
        userAgent,
        timestamp: new Date().toISOString(),
      });

      // Log errors
      if (statusCode >= 400) {
        const errorLogData: Record<string, unknown> = {
          method,
          url: originalUrl,
          statusCode,
          duration: `${duration}ms`,
          ip,
          userAgent,
        };

        if (this.options.enableBodyLogging) {
          // Full body logging (with sanitization and truncation)
          errorLogData.error = this.prepareLogContent(chunk);
        } else {
          // Safe field extraction only
          const safeErrorInfo = this.extractSafeErrorInfo(chunk);
          if (Object.keys(safeErrorInfo).length > 0) {
            errorLogData.error = safeErrorInfo;
          }
        }

        this.logger.error(
          `Error response for ${method} ${originalUrl}`,
          errorLogData,
        );
      }

      // Call original end method with all parameters
      return originalEnd(chunk, encoding as BufferEncoding, cb);
    };

    next();
  }
}
