import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { ConfigService } from "@nestjs/config";
import { validate, ValidationError } from "class-validator";
import { plainToClass } from "class-transformer";

export interface ValidationConfig {
  enabled: boolean;
  maxBodySize: number;
  maxDepth: number;
  allowedContentTypes: string[];
  pipe: {
    whitelist: boolean;
    forbidNonWhitelisted: boolean;
    transform: boolean;
    forbidUnknownValues: boolean;
    skipMissingProperties: boolean;
    skipNullProperties: boolean;
    skipUndefinedProperties: boolean;
    validationError: {
      target: boolean;
      value: boolean;
    };
  };
}

@Injectable()
export class EnhancedValidationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(EnhancedValidationMiddleware.name);
  private validationConfig: ValidationConfig;

  constructor(private readonly configService: ConfigService) {
    const rawConfig: unknown = this.configService.get("security.validation");

    if (!rawConfig) {
      throw new Error("Missing or invalid configuration: security.validation");
    }

    this.validationConfig = this.validateAndSanitizeConfig(rawConfig);
  }

  private validateAndSanitizeConfig(rawConfig: unknown): ValidationConfig {
    if (typeof rawConfig !== "object" || rawConfig === null) {
      throw new Error(
        "Missing or invalid configuration: security.validation - must be an object",
      );
    }

    if (!this.isRecord(rawConfig)) {
      throw new Error(
        "Missing or invalid configuration: security.validation - must be a valid object",
      );
    }

    const configRecord = rawConfig;

    const config: ValidationConfig = {
      enabled: this.validateBoolean(configRecord.enabled, true),
      maxBodySize: this.validateNumber(configRecord.maxBodySize, 1024 * 1024),
      maxDepth: this.validateNumber(configRecord.maxDepth, 10),
      allowedContentTypes: this.validateStringArray(
        configRecord.allowedContentTypes,
        [
          "application/json",
          "application/x-www-form-urlencoded",
          "multipart/form-data",
          "text/plain",
        ],
      ),
      pipe: {
        whitelist: this.validateBoolean(
          this.isRecord(configRecord.pipe)
            ? configRecord.pipe.whitelist
            : undefined,
          true,
        ),
        forbidNonWhitelisted: this.validateBoolean(
          this.isRecord(configRecord.pipe)
            ? configRecord.pipe.forbidNonWhitelisted
            : undefined,
          false,
        ),
        transform: this.validateBoolean(
          this.isRecord(configRecord.pipe)
            ? configRecord.pipe.transform
            : undefined,
          true,
        ),
        forbidUnknownValues: this.validateBoolean(
          this.isRecord(configRecord.pipe)
            ? configRecord.pipe.forbidUnknownValues
            : undefined,
          false,
        ),
        skipMissingProperties: this.validateBoolean(
          this.isRecord(configRecord.pipe)
            ? configRecord.pipe.skipMissingProperties
            : undefined,
          false,
        ),
        skipNullProperties: this.validateBoolean(
          this.isRecord(configRecord.pipe)
            ? configRecord.pipe.skipNullProperties
            : undefined,
          false,
        ),
        skipUndefinedProperties: this.validateBoolean(
          this.isRecord(configRecord.pipe)
            ? configRecord.pipe.skipUndefinedProperties
            : undefined,
          false,
        ),
        validationError: {
          target: this.validateBoolean(
            this.isRecord(configRecord.pipe) &&
              this.isRecord(configRecord.pipe.validationError)
              ? configRecord.pipe.validationError.target
              : undefined,
            false,
          ),
          value: this.validateBoolean(
            this.isRecord(configRecord.pipe) &&
              this.isRecord(configRecord.pipe.validationError)
              ? configRecord.pipe.validationError.value
              : undefined,
            false,
          ),
        },
      },
    };

    return config;
  }

  private validateBoolean(value: unknown, defaultValue: boolean): boolean {
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      const lowerValue = value.toLowerCase();
      if (lowerValue === "true") return true;
      if (lowerValue === "false") return false;
    }
    return defaultValue;
  }

  private validateNumber(value: unknown, defaultValue: number): number {
    const num = Number(value);
    if (!isNaN(num) && isFinite(num) && num >= 0) {
      return num;
    }
    return defaultValue;
  }

  private validateStringArray(
    value: unknown,
    defaultValue: string[],
  ): string[] {
    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === "string")
    ) {
      return value;
    }
    return defaultValue;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  async use(req: Request, res: Response, next: NextFunction) {
    if (!this.validationConfig.enabled) {
      return next();
    }

    try {
      this.validateContentType(req);
      this.validatePayloadSize(req);
      await this.validateRequestStructure(req);
      this.applyCustomValidationRules(req);

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error("Validation middleware error:", error);
      throw new HttpException(
        {
          error: "Validation Failed",
          message: "Request validation failed",
          statusCode: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private validateContentType(req: Request): void {
    const contentType = req.headers["content-type"];

    if (!contentType) {
      return;
    }

    const isValidContentType = this.validationConfig.allowedContentTypes.some(
      (allowedType) => {
        if (allowedType.includes("*")) {
          const baseType = allowedType.split("/")[0];
          return contentType.startsWith(baseType + "/");
        }
        return contentType.includes(allowedType);
      },
    );

    if (!isValidContentType) {
      this.logger.warn(`Invalid content-type: ${contentType} from ${req.ip}`);
      throw new HttpException(
        {
          error: "Unsupported Media Type",
          message: `Content-Type '${contentType}' is not supported`,
          statusCode: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        },
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
      );
    }
  }

  private validatePayloadSize(req: Request): void {
    const actualBodySize = this.getActualBodySize(req);

    if (actualBodySize > this.validationConfig.maxBodySize) {
      this.logger.warn(
        `Payload too large: ${actualBodySize} bytes from ${req.ip}`,
      );
      throw new HttpException(
        {
          error: "Payload Too Large",
          message: `Request payload exceeds maximum allowed size of ${
            this.validationConfig.maxBodySize / (1024 * 1024)
          }MB`,
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }
  }

  private getActualBodySize(req: Request): number {
    if (req.body) {
      if (Buffer.isBuffer(req.body)) {
        return req.body.length;
      }
      if (typeof req.body === "string") {
        return Buffer.byteLength(req.body, "utf8");
      }
      if (typeof req.body === "object") {
        return Buffer.byteLength(JSON.stringify(req.body), "utf8");
      }
    }

    if (req.body && Buffer.isBuffer(req.body)) {
      return req.body.length;
    }

    if (req.body && typeof req.body === "string") {
      return Buffer.byteLength(req.body, "utf8");
    }

    this.logger.warn(
      `Unable to determine actual body size for request from ${req.ip}. ` +
        "Relying on body-parser limits. Consider placing this middleware after body parsing.",
    );

    return 0;
  }

  private async validateRequestStructure(req: Request): Promise<void> {
    if (req.body && typeof req.body === "object") {
      await this.validateObjectDepth(req.body, 0);
    }

    if (req.query && typeof req.query === "object") {
      await this.validateObjectDepth(req.query, 0);
    }

    if (req.params && typeof req.params === "object") {
      await this.validateObjectDepth(req.params, 0);
    }
  }

  private async validateObjectDepth(
    obj: any,
    currentDepth: number,
  ): Promise<void> {
    if (currentDepth > this.validationConfig.maxDepth) {
      throw new HttpException(
        {
          error: "Bad Request",
          message: "Request structure is too deeply nested",
          statusCode: HttpStatus.BAD_REQUEST,
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (typeof item === "object" && item !== null) {
          await this.validateObjectDepth(item, currentDepth + 1);
        }
      }
    } else if (typeof obj === "object" && obj !== null) {
      for (const value of Object.values(obj)) {
        if (typeof value === "object" && value !== null) {
          await this.validateObjectDepth(value, currentDepth + 1);
        }
      }
    }
  }

  private applyCustomValidationRules(req: Request): void {
    const route = req.originalUrl || req.path;
    const cleanRoute = route.split("?")[0];

    if (this.isSensitiveEndpoint(cleanRoute)) {
      this.applyStrictValidation(req);
    }

    if (this.requiresSchemaValidation(cleanRoute)) {
      this.applySchemaValidation(req, cleanRoute);
    }
  }

  private isSensitiveEndpoint(route: string): boolean {
    const sensitivePatterns = [
      /\/auth\//,
      /\/admin\//,
      /\/payment\//,
      /\/user\//,
      /\/api\/v1\/internal\//,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(route));
  }

  private requiresSchemaValidation(route: string): boolean {
    const schemaValidationPatterns = [
      /\/user\/create/,
      /\/payment\/process/,
      /\/auth\/register/,
      /\/auth\/login/,
    ];

    return schemaValidationPatterns.some((pattern) => pattern.test(route));
  }

  private applyStrictValidation(req: Request): void {
    if (req.body) {
      const bodyString = JSON.stringify(req.body);

      if (this.containsNoSQLInjection(bodyString)) {
        this.logger.warn(`NoSQL injection attempt detected from ${req.ip}`);
        throw new HttpException(
          {
            error: "Bad Request",
            message: "Request contains potentially malicious content",
            statusCode: HttpStatus.BAD_REQUEST,
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (this.containsCommandInjection(bodyString)) {
        this.logger.warn(`Command injection attempt detected from ${req.ip}`);
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

  private applySchemaValidation(req: Request, route: string): void {
    if (req.body && typeof req.body === "object") {
      const requiredFields = this.getRequiredFieldsForRoute(route);

      for (const field of requiredFields) {
        if (
          !(field in req.body) ||
          (req.body as Record<string, any>)[field] === undefined ||
          (req.body as Record<string, any>)[field] === null
        ) {
          throw new HttpException(
            {
              error: "Bad Request",
              message: `Required field '${field}' is missing`,
              statusCode: HttpStatus.BAD_REQUEST,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      this.validateFieldTypes(req.body, route);
    }
  }

  private getRequiredFieldsForRoute(route: string): string[] {
    const routeRequirements: Record<string, string[]> = {
      "/auth/register": ["email", "password", "username"],
      "/auth/login": ["email", "password"],
      "/user/create": ["email", "username", "firstName", "lastName"],
      "/payment/process": ["amount", "currency", "paymentMethod"],
    };

    return routeRequirements[route] || [];
  }

  private validateFieldTypes(body: any, route: string): void {
    for (const [field, value] of Object.entries(body)) {
      const expectedType = this.getExpectedTypeForField(field, route);

      if (expectedType && !this.isValidType(value, expectedType)) {
        throw new HttpException(
          {
            error: "Bad Request",
            message: `Field '${field}' must be of type '${expectedType}'`,
            statusCode: HttpStatus.BAD_REQUEST,
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private getExpectedTypeForField(field: string, route: string): string | null {
    const fieldTypes: Record<string, Record<string, string>> = {
      "/auth/register": {
        email: "string",
        password: "string",
        username: "string",
      },
      "/auth/login": {
        email: "string",
        password: "string",
      },
      "/user/create": {
        email: "string",
        username: "string",
        firstName: "string",
        lastName: "string",
      },
      "/payment/process": {
        amount: "number",
        currency: "string",
        paymentMethod: "string",
      },
    };

    return fieldTypes[route]?.[field] || null;
  }

  private isValidType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "array":
        return Array.isArray(value);
      case "object":
        return (
          typeof value === "object" && value !== null && !Array.isArray(value)
        );
      default:
        return true;
    }
  }

  private containsNoSQLInjection(content: string): boolean {
    const noSQLPatterns = [
      /\$where/i,
      /\$ne/i,
      /\$gt/i,
      /\$lt/i,
      /\$regex/i,
      /\$exists/i,
      /\$in/i,
      /\$nin/i,
      /\$or/i,
      /\$and/i,
      /\$not/i,
      /\$nor/i,
    ];

    return noSQLPatterns.some((pattern) => pattern.test(content));
  }

  private containsCommandInjection(content: string): boolean {
    const commandPatterns = [
      /[;&|`$(){}[\]]/,
      /(?:rm|del|rmdir|mkdir|cp|mv|chmod|chown|sudo|su|bash|sh|cmd|powershell)/i,
      /(?:eval|exec|system|spawn|require|import)/i,
    ];

    return commandPatterns.some((pattern) => pattern.test(content));
  }

  async validateDTO(dtoClass: any, data: any): Promise<ValidationError[]> {
    const dtoObject = plainToClass(dtoClass, data);
    return validate(dtoObject, {
      whitelist: this.validationConfig.pipe.whitelist,
      forbidNonWhitelisted: this.validationConfig.pipe.forbidNonWhitelisted,
      skipMissingProperties: this.validationConfig.pipe.skipMissingProperties,
      skipNullProperties: this.validationConfig.pipe.skipNullProperties,
      skipUndefinedProperties:
        this.validationConfig.pipe.skipUndefinedProperties,
    });
  }
}
