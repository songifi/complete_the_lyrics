import {
  Injectable,
  NestMiddleware,
  Logger,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { ConfigService } from "@nestjs/config";

interface PayloadLimitsConfig {
  maxSize?: number;
  enableStreamMonitoring?: boolean;
  abortOnOversize?: boolean;
  logOversizeAttempts?: boolean;
  parameterLimit?: number;
}

@Injectable()
export class PayloadSizeMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PayloadSizeMiddleware.name);
  private readonly maxSize: number;
  private readonly enableStreamMonitoring: boolean;
  private readonly abortOnOversize: boolean;
  private readonly logOversizeAttempts: boolean;

  constructor(private readonly configService: ConfigService) {
    const payloadConfig = this.configService.get<PayloadLimitsConfig>(
      "security.payloadLimits",
    );
    this.maxSize = payloadConfig?.maxSize || 10 * 1024 * 1024;
    this.enableStreamMonitoring = payloadConfig?.enableStreamMonitoring ?? true;
    this.abortOnOversize = payloadConfig?.abortOnOversize ?? true;
    this.logOversizeAttempts = payloadConfig?.logOversizeAttempts ?? true;
  }

  use(req: Request, res: Response, next: NextFunction) {
    if (!["POST", "PUT", "PATCH"].includes(req.method)) {
      return next();
    }

    const actualBodySize = this.getActualBodySize(req);
    if (actualBodySize > this.maxSize) {
      this.logOversizeAttempt("actual body size", actualBodySize);
      throw new HttpException(
        {
          error: "Payload Too Large",
          message: `Request payload exceeds maximum allowed size of ${this.maxSize / (1024 * 1024)}MB`,
          statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
          path: req.path,
          method: req.method,
        },
        HttpStatus.PAYLOAD_TOO_LARGE,
      );
    }

    if (this.enableStreamMonitoring) {
      this.monitorRequestStream(req, res);
    }

    next();
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

    return 0;
  }

  private monitorRequestStream(req: Request, res: Response) {
    let bytesReceived = 0;
    let isAborted = false;

    const handlePayloadError = () => {
      if (isAborted) return;
      isAborted = true;

      this.logOversizeAttempt("stream monitoring", bytesReceived);

      req.removeAllListeners("data");
      req.removeAllListeners("end");
      req.removeAllListeners("error");

      res.status(413).end("Payload Too Large");

      if (this.abortOnOversize) {
        req.destroy(new Error("Request payload too large"));
      }
    };

    req.on("data", (chunk: Buffer) => {
      if (isAborted) return;

      bytesReceived += chunk.length;

      if (bytesReceived > this.maxSize) {
        handlePayloadError();
        return;
      }
    });

    if (
      req.headers["transfer-encoding"] === "chunked" ||
      !req.headers["content-length"]
    ) {
      this.logger.debug("Monitoring request stream for size limits", {
        path: req.path,
        method: req.method,
        transferEncoding: req.headers["transfer-encoding"],
        hasContentLength: !!req.headers["content-length"],
        maxSize: this.maxSize,
      });
    }

    req.on("end", () => {
      if (isAborted) return;

      if (bytesReceived > 0) {
        this.logger.debug("Request stream completed", {
          path: req.path,
          method: req.method,
          bytesReceived,
          maxSize: this.maxSize,
        });
      }
    });

    req.on("error", (error: Error) => {
      if (isAborted) return;

      if (error.message.includes("payload too large")) {
        this.logger.warn("Request stream aborted due to oversized payload", {
          path: req.path,
          method: req.method,
          bytesReceived,
          maxSize: this.maxSize,
          error: error.message,
        });
      }

      req.removeAllListeners("data");
      req.removeAllListeners("end");
      req.removeAllListeners("error");
    });
  }

  private logOversizeAttempt(source: string, size: number) {
    if (this.logOversizeAttempts) {
      this.logger.warn("Oversized payload attempt detected", {
        source,
        size,
        maxSize: this.maxSize,
        sizeMB: (size / (1024 * 1024)).toFixed(2),
        maxSizeMB: (this.maxSize / (1024 * 1024)).toFixed(2),
      });
    }
  }
}
