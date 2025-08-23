import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { Address4, Address6 } from "ip-address";

export interface SecurityConfig {
  ipControl: {
    enabled: boolean;
    whitelist: string[];
    blacklist: string[];
    allowPrivateNetworks: boolean;
    allowLocalhost: boolean;
  };
  apiKeys: {
    enabled: boolean;
    validKeys: string[];
    headerName: string;
    queryParamName: string;
    requireForSensitiveEndpoints: boolean;
  };
  bruteForce: {
    enabled: boolean;
    maxAttempts: number;
    windowMs: number;
    blockDuration: number;
    trackBy: string;
  };
  sqlInjection: {
    enabled: boolean;
    blockPatterns: RegExp[];
    logAttempts: boolean;
    blockAttempts: boolean;
  };
  xss: {
    enabled: boolean;
    mode: string;
    reportUri: string | null;
    blockPatterns: RegExp[];
  };
  sanitization: {
    enabled: boolean;
    removeNullBytes: boolean;
    removeControlCharacters: boolean;
    maxStringLength: number;
    allowedHtmlTags: string[];
    sanitizeUserInput: boolean;
  };
}

@Injectable()
export class ComprehensiveSecurityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ComprehensiveSecurityMiddleware.name);
  private redis: Redis;
  private securityConfig: SecurityConfig;

  constructor(private readonly configService: ConfigService) {
    const securityConfig = this.configService.get<SecurityConfig>("security");

    if (!securityConfig) {
      this.logger.warn("Security configuration not found, using safe defaults");
      this.securityConfig = this.getDefaultSecurityConfig();
    } else {
      this.securityConfig = securityConfig;
    }

    this.redis = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      keyPrefix: "security:",
      maxRetriesPerRequest: 3,
    });

    this.redis.on("error", (error) => {
      this.logger.error("Redis connection error:", error);
    });
  }

  private getDefaultSecurityConfig(): SecurityConfig {
    return {
      ipControl: {
        enabled: false,
        whitelist: [],
        blacklist: [],
        allowPrivateNetworks: false,
        allowLocalhost: true,
      },
      apiKeys: {
        enabled: false,
        validKeys: [],
        headerName: "x-api-key",
        queryParamName: "api_key",
        requireForSensitiveEndpoints: false,
      },
      bruteForce: {
        enabled: false,
        maxAttempts: 5,
        windowMs: 900000,
        blockDuration: 3600000,
        trackBy: "ip",
      },
      sqlInjection: {
        enabled: false,
        blockPatterns: [],
        logAttempts: true,
        blockAttempts: false,
      },
      xss: {
        enabled: false,
        mode: "sanitize",
        reportUri: null,
        blockPatterns: [],
      },
      sanitization: {
        enabled: true,
        removeNullBytes: true,
        removeControlCharacters: true,
        maxStringLength: 10000,
        allowedHtmlTags: [],
        sanitizeUserInput: true,
      },
    };
  }

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      this.validateIpAddress(req);
      this.validateApiKey(req);
      await this.checkBruteForceProtection(req);
      this.checkSqlInjection(req);
      this.checkXssProtection(req);
      this.sanitizeInput(req);
      this.setSecurityHeaders(res);

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error("Security middleware error:", error);
      throw new HttpException(
        {
          error: "Security Check Failed",
          message: "Request blocked for security reasons",
          statusCode: HttpStatus.FORBIDDEN,
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private validateIpAddress(req: Request): void {
    if (!this.securityConfig.ipControl.enabled) return;

    const clientIP = this.getClientIP(req);

    if (this.securityConfig.ipControl.blacklist.includes(clientIP)) {
      this.logger.warn(`Blocked request from blacklisted IP: ${clientIP}`);
      throw new HttpException(
        {
          error: "Access Denied",
          message: "Your IP address is not allowed to access this service",
          statusCode: HttpStatus.FORBIDDEN,
        },
        HttpStatus.FORBIDDEN,
      );
    }

    if (this.securityConfig.ipControl.whitelist.length > 0) {
      const isWhitelisted = this.securityConfig.ipControl.whitelist.some(
        (allowedIP) => this.isIPInRange(clientIP, allowedIP),
      );

      if (!isWhitelisted) {
        this.logger.warn(
          `Blocked request from non-whitelisted IP: ${clientIP}`,
        );
        throw new HttpException(
          {
            error: "Access Denied",
            message: "Your IP address is not allowed to access this service",
            statusCode: HttpStatus.FORBIDDEN,
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }
  }

  private validateApiKey(req: Request): void {
    if (!this.securityConfig.apiKeys.enabled) return;

    const apiKey =
      (req.headers[
        this.securityConfig.apiKeys.headerName.toLowerCase()
      ] as string) ||
      (req.query[this.securityConfig.apiKeys.queryParamName] as string);

    if (!apiKey) {
      this.logger.warn("API key missing from request");
      throw new HttpException(
        {
          error: "Unauthorized",
          message: "API key is required",
          statusCode: HttpStatus.UNAUTHORIZED,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!this.securityConfig.apiKeys.validKeys.includes(apiKey)) {
      this.logger.warn("Invalid API key provided");
      throw new HttpException(
        {
          error: "Unauthorized",
          message: "Invalid API key",
          statusCode: HttpStatus.UNAUTHORIZED,
        },
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private async checkBruteForceProtection(req: Request): Promise<void> {
    if (!this.securityConfig.bruteForce.enabled) return;

    const key =
      this.securityConfig.bruteForce.trackBy === "user"
        ? `brute_force:${req.headers.authorization || req.ip}`
        : `brute_force:${req.ip}`;

    const attempts = await this.redis.get(key);
    const attemptCount = attempts ? parseInt(attempts) : 0;

    if (attemptCount >= this.securityConfig.bruteForce.maxAttempts) {
      this.logger.warn(`Brute force attempt detected from ${req.ip}`);
      throw new HttpException(
        {
          error: "Too Many Requests",
          message: "Too many failed attempts. Please try again later.",
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.redis.incr(key);
    await this.redis.expire(
      key,
      this.securityConfig.bruteForce.windowMs / 1000,
    );
  }

  private checkSqlInjection(req: Request): void {
    if (!this.securityConfig.sqlInjection.enabled) return;

    const requestData = JSON.stringify({
      body: req.body as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      params: req.params as Record<string, unknown>,
      headers: req.headers as Record<string, unknown>,
    });

    for (const pattern of this.securityConfig.sqlInjection.blockPatterns) {
      if (pattern.test(requestData)) {
        if (this.securityConfig.sqlInjection.logAttempts) {
          this.logger.warn(
            `SQL injection attempt detected from ${req.ip}: ${pattern.source}`,
          );
        }

        if (this.securityConfig.sqlInjection.blockAttempts) {
          throw new HttpException(
            {
              error: "Bad Request",
              message: "Request contains potentially malicious content",
              statusCode: HttpStatus.BAD_REQUEST,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }
    }
  }

  private checkXssProtection(req: Request): void {
    if (!this.securityConfig.xss.enabled) return;

    const requestData = JSON.stringify({
      body: req.body as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      params: req.params as Record<string, unknown>,
    });

    for (const pattern of this.securityConfig.xss.blockPatterns) {
      if (pattern.test(requestData)) {
        this.logger.warn(
          `XSS attempt detected from ${req.ip}: ${pattern.source}`,
        );
        throw new HttpException(
          {
            error: "Bad Request",
            message: "Request contains potentially malicious content",
            statusCode: HttpStatus.BAD_REQUEST,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private sanitizeInput(req: Request): void {
    if (!this.securityConfig.sanitization.enabled) return;

    if (req.body && typeof req.body === "object") {
      req.body = this.sanitizeObject(req.body);
    }

    if (req.query && typeof req.query === "object") {
      req.query = this.sanitizeObject(req.query) as typeof req.query;
    }

    if (req.params && typeof req.params === "object") {
      req.params = this.sanitizeObject(req.params) as typeof req.params;
    }
  }

  private sanitizeObject(
    obj: Record<string, unknown> | unknown[] | string,
  ): Record<string, unknown> | unknown[] | string {
    if (Array.isArray(obj)) {
      return obj.map((item) =>
        this.sanitizeObject(
          item as Record<string, unknown> | unknown[] | string,
        ),
      );
    }

    if (obj && typeof obj === "object") {
      const sanitized: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === "string") {
          sanitized[key] = this.sanitizeString(value);
        } else if (typeof value === "object" && value !== null) {
          sanitized[key] = this.sanitizeObject(
            value as Record<string, unknown> | unknown[] | string,
          );
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    if (typeof obj === "string") {
      return this.sanitizeString(obj);
    }

    return obj;
  }

  private sanitizeString(str: string): string {
    if (!str) return str;

    let sanitized = str;

    if (this.securityConfig.sanitization.removeNullBytes) {
      sanitized = sanitized.replace(/\0/g, "");
    }

    if (this.securityConfig.sanitization.removeControlCharacters) {
      // eslint-disable-next-line no-control-regex
      sanitized = sanitized.replace(/[\u0000-\u001F\u007F]/g, "");
    }

    if (sanitized.length > this.securityConfig.sanitization.maxStringLength) {
      sanitized = sanitized.substring(
        0,
        this.securityConfig.sanitization.maxStringLength,
      );
    }

    return sanitized;
  }

  private setSecurityHeaders(res: Response): void {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()",
    );

    if (process.env.NODE_ENV === "production") {
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains; preload",
      );
    }
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.ip ||
      "unknown"
    );
  }

  private isIPInRange(ip: string, range: string): boolean {
    if (range.includes("/")) {
      return this.isIPInCIDR(ip, range);
    }
    return ip === range;
  }

  private isIPInCIDR(ip: string, cidr: string): boolean {
    try {
      const [network, bits] = cidr.split("/");
      if (!network || !bits) return false;

      const prefixLength = parseInt(bits);
      if (isNaN(prefixLength) || prefixLength < 0) return false;

      if (network.includes(":")) {
        const address6 = new Address6(ip);
        const subnet6 = new Address6(network + "/" + bits);
        return address6.isInSubnet(subnet6);
      } else {
        const address4 = new Address4(ip);
        const subnet4 = new Address4(network + "/" + bits);
        return address4.isInSubnet(subnet4);
      }
    } catch {
      return false;
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}
