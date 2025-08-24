import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

export interface RequestWithNonce extends Request {
  cspNonce: string;
}

@Injectable()
export class CspMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CspMiddleware.name);

  use(req: RequestWithNonce, res: Response, next: NextFunction) {
    const nonce = randomBytes(16).toString("base64");

    req.cspNonce = nonce;

    if (
      process.env.NODE_ENV !== "production" &&
      process.env.LOG_LEVEL === "debug"
    ) {
      res.setHeader("X-CSP-Nonce", nonce);
    }

    if (process.env.LOG_LEVEL === "debug") {
      this.logger.debug(
        `Generated CSP nonce: ${nonce} for request to ${req.path}`,
      );
    } else {
      const truncatedNonce = nonce.substring(0, 6) + "...";
      this.logger.log(
        `Generated CSP nonce: ${truncatedNonce} for request to ${req.path}`,
      );
    }

    next();
  }
}
