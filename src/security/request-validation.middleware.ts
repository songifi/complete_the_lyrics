import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { validate } from "class-validator";
import { plainToClass } from "class-transformer";

export interface ValidationSchema {
  body?: new () => object;
  query?: new () => object;
  params?: new () => object;
}

@Injectable()
export class RequestValidationMiddleware implements NestMiddleware {
  constructor(private schema?: ValidationSchema) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      if (this.schema?.body && req.body) {
        const bodyClass = plainToClass(this.schema.body, req.body);
        const bodyErrors = await validate(bodyClass, {
          skipMissingProperties: true,
        });

        if (bodyErrors.length > 0) {
          const validationErrors = bodyErrors.map((error) => ({
            field: error.property,
            constraints: error.constraints,
            value: error.value as unknown,
          }));

          throw new HttpException(
            {
              error: "Validation Error",
              message: "Request body validation failed",
              details: validationErrors,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (this.schema?.query && Object.keys(req.query).length > 0) {
        const queryClass = plainToClass(this.schema.query, req.query);
        const queryErrors = await validate(queryClass, {
          skipMissingProperties: true,
        });

        if (queryErrors.length > 0) {
          const validationErrors = queryErrors.map((error) => ({
            field: error.property,
            constraints: error.constraints,
            value: error.value as unknown,
          }));

          throw new HttpException(
            {
              error: "Validation Error",
              message: "Query parameters validation failed",
              details: validationErrors,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      if (this.schema?.params && Object.keys(req.params).length > 0) {
        const paramsClass = plainToClass(this.schema.params, req.params);
        const paramsErrors = await validate(paramsClass, {
          skipMissingProperties: true,
        });

        if (paramsErrors.length > 0) {
          const validationErrors = paramsErrors.map((error) => ({
            field: error.property,
            constraints: error.constraints,
            value: error.value as unknown,
          }));

          throw new HttpException(
            {
              error: "Validation Error",
              message: "URL parameters validation failed",
              details: validationErrors,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
      }

      this.performSecurityChecks(req);

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          error: "Validation Error",
          message: "Request validation failed",
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private performSecurityChecks(req: Request) {
    const suspiciousHeaders = [
      "x-forwarded-host",
      "x-forwarded-proto",
      "x-forwarded-for",
      "x-real-ip",
    ];

    suspiciousHeaders.forEach((header) => {
      const headerValue = req.headers[header];
      if (headerValue) {
        console.warn(
          `Suspicious header detected: ${header} = ${Array.isArray(headerValue) ? headerValue[0] : headerValue}`,
        );
      }
    });

    const actualBodySize = this.getActualBodySize(req);
    const maxSize = 10 * 1024 * 1024;

    if (actualBodySize > maxSize) {
      throw new HttpException(
        {
          error: "Payload Too Large",
          message: "Request body exceeds maximum allowed size",
          maxSize: maxSize,
          receivedSize: actualBodySize,
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    const contentType = req.headers["content-type"] || "";
    const allowedTypes = [
      "application/json",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "text/plain",
    ];

    if (req.method !== "GET" && req.method !== "HEAD") {
      const isAllowed = allowedTypes.some((type) => contentType.includes(type));
      if (!isAllowed) {
        throw new HttpException(
          {
            error: "Unsupported Media Type",
            message: "Content type not allowed",
            allowedTypes,
            receivedType: contentType,
          },
          HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        );
      }
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

    return 0;
  }
}
