import { Injectable, NestMiddleware, Logger } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { CspService } from "./csp.service";
import { RequestWithNonce } from "./csp.middleware";

@Injectable()
export class CspHeaderMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CspHeaderMiddleware.name);

  constructor(private readonly cspService: CspService) {}

  use(req: RequestWithNonce, res: Response, next: NextFunction) {
    try {
      if (!req.cspNonce || !this.cspService.validateNonce(req.cspNonce)) {
        this.logger.warn(
          `Invalid or missing CSP nonce for request to ${req.path}`,
        );
        return next();
      }

      const cspHeader = this.cspService.generateCspHeader(req.cspNonce);

      res.setHeader("Content-Security-Policy", cspHeader);

      const enableReportOnly = process.env.CSP_REPORT_ONLY === "true";
      if (enableReportOnly) {
        const cspReportOnlyHeader = this.cspService.generateCspReportOnlyHeader(
          req.cspNonce,
        );
        res.setHeader(
          "Content-Security-Policy-Report-Only",
          cspReportOnlyHeader,
        );
        this.logger.debug("CSP report-only mode enabled");
      }

      this.logger.debug(`Set CSP header for request to ${req.path} with nonce`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Error setting CSP header: ${errorMessage}`,
        errorStack,
      );
    }

    next();
  }
}
