import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface CspDirectives {
  defaultSrc: string[];
  styleSrc: string[];
  scriptSrc: string[];
  imgSrc: string[];
  connectSrc: string[];
  fontSrc: string[];
  objectSrc: string[];
  mediaSrc: string[];
  frameSrc: string[];
  baseUri: string[];
  frameAncestors: string[];
  manifestSrc: string[];
  workerSrc: string[];
  formAction: string[];
  upgradeInsecureRequests?: boolean | string[];
  reportUri?: string[];
}

@Injectable()
export class CspService {
  private readonly logger = new Logger(CspService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Generate CSP header value with nonce for the current request
   * @param nonce - Cryptographically random nonce for this request
   * @returns CSP header value string
   */
  generateCspHeader(nonce: string): string {
    const directives = this.getCspDirectives(nonce);

    // Convert directives object to CSP header string
    const cspParts = Object.entries(directives)
      .filter(
        ([, value]) =>
          value === true || (Array.isArray(value) && value.length > 0),
      )
      .map(([key, value]) => {
        if (key === "upgradeInsecureRequests" && value === true) {
          return "upgrade-insecure-requests";
        }
        return `${this.kebabCase(key)} ${value.join(" ")}`;
      });

    const cspHeader = cspParts.join("; ");

    this.logger.debug(`Generated CSP header with nonce: ${nonce}`);

    return cspHeader;
  }

  /**
   * Get CSP directives with nonce support
   * @param nonce - Cryptographically random nonce for this request
   * @returns CSP directives object
   */
  private getCspDirectives(nonce: string): CspDirectives {
    const isProduction = this.configService.get("NODE_ENV") === "production";

    return {
      defaultSrc: ["'self'"],
      styleSrc: [
        "'self'",
        `'nonce-${nonce}'`,
        // Add any external stylesheets if needed
        // "https://fonts.googleapis.com",
        // "https://cdn.jsdelivr.net",
      ],
      scriptSrc: [
        "'self'",
        `'nonce-${nonce}'`,
        // Add any external scripts if needed
        // "https://cdn.jsdelivr.net",
        // "https://www.googletagmanager.com",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "https:",
        // Add specific image sources if needed
        // "https://cdn.example.com",
      ],
      connectSrc: [
        "'self'",
        "https:",
        // Add specific API endpoints if needed
        // "https://api.example.com",
        // "wss://example.com", // for WebSocket connections
      ],
      fontSrc: [
        "'self'",
        "data:",
        // Add external font sources if needed
        // "https://fonts.gstatic.com",
      ],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: isProduction, // Only enable in production
    };
  }

  /**
   * Convert camelCase to kebab-case for CSP directive names
   * @param str - camelCase string
   * @returns kebab-case string
   */
  private kebabCase(str: string): string {
    return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, "$1-$2").toLowerCase();
  }

  /**
   * Validate that a nonce is properly formatted
   * @param nonce - Nonce to validate
   * @returns true if valid, false otherwise
   */
  validateNonce(nonce: string): boolean {
    if (!nonce || typeof nonce !== "string") {
      return false;
    }

    // Nonce should be base64 encoded and reasonable length
    const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;
    return base64Regex.test(nonce) && nonce.length >= 16 && nonce.length <= 64;
  }

  /**
   * Get CSP report-only header (for testing CSP policies)
   * @param nonce - Cryptographically random nonce for this request
   * @returns CSP report-only header value string
   */
  generateCspReportOnlyHeader(nonce: string): string {
    const directives = this.getCspDirectives(nonce);

    const reportOnlyDirectives: CspDirectives = { ...directives };

    // Add report-uri directive for CSP violations
    const reportUri = this.configService.get("CSP_REPORT_URI");
    if (reportUri) {
      reportOnlyDirectives.reportUri = [reportUri];
    }

    // Convert to header string
    const cspParts = Object.entries(reportOnlyDirectives)
      .filter(
        ([, value]) =>
          value === true || (Array.isArray(value) && value.length > 0),
      )
      .map(([key, value]) => {
        if (key === "upgradeInsecureRequests" && value === true) {
          return "upgrade-insecure-requests";
        }
        return `${this.kebabCase(key)} ${value.join(" ")}`;
      });

    return cspParts.join("; ");
  }
}
