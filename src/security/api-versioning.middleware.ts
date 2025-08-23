import {
  Injectable,
  NestMiddleware,
  Logger,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

export interface ApiVersion {
  version: string;
  deprecated: boolean;
  sunsetDate?: string;
  alternative?: string;
}

@Injectable()
export class ApiVersioningMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiVersioningMiddleware.name);
  private readonly supportedVersions = new Map<string, ApiVersion>([
    ["1.0", { version: "1.0", deprecated: false }],
    ["1.1", { version: "1.1", deprecated: false }],
    ["2.0", { version: "2.0", deprecated: false }],
    [
      "1.0-beta",
      {
        version: "1.0-beta",
        deprecated: true,
        sunsetDate: "2024-12-31",
        alternative: "1.0",
      },
    ],
  ]);

  use(req: Request, res: Response, next: NextFunction) {
    // Extract API version from header, query param, or URL path
    const apiVersion = this.extractApiVersion(req);

    if (!apiVersion) {
      // No version specified, use latest stable version
      req["apiVersion"] = this.getLatestStableVersion();
      return next();
    }

    // Validate API version
    if (!this.isVersionSupported(apiVersion)) {
      throw new HttpException(
        {
          error: "Unsupported API Version",
          message: `API version '${apiVersion}' is not supported. Supported versions: ${Array.from(this.supportedVersions.keys()).join(", ")}`,
          statusCode: HttpStatus.BAD_REQUEST,
          supportedVersions: Array.from(this.supportedVersions.keys()),
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Check if version is deprecated
    const versionInfo = this.supportedVersions.get(apiVersion);
    if (versionInfo?.deprecated) {
      this.logger.warn(`Deprecated API version used`, {
        version: apiVersion,
        path: req.path,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });

      // Add deprecation warning headers
      res.setHeader("X-API-Deprecated", "true");
      res.setHeader("X-API-Sunset-Date", versionInfo.sunsetDate || "TBD");
      if (versionInfo.alternative) {
        res.setHeader("X-API-Alternative", versionInfo.alternative);
      }
      res.setHeader(
        "X-API-Deprecation-Warning",
        `This API version is deprecated and will be removed on ${versionInfo.sunsetDate}. Please upgrade to version ${versionInfo.alternative || "latest"}.`,
      );
    }

    // Set API version in request object
    req["apiVersion"] = apiVersion;

    // Add version info to response headers
    res.setHeader("X-API-Version", apiVersion);
    res.setHeader("X-API-Latest-Version", this.getLatestStableVersion());

    next();
  }

  private extractApiVersion(req: Request): string | null {
    // Check header first
    const headerVersion = req.get("X-API-Version");
    if (headerVersion) {
      return headerVersion;
    }

    // Check query parameter
    const queryVersion = req.query.version as string;
    if (queryVersion) {
      return queryVersion;
    }

    // Check URL path for version (e.g., /api/v1/users)
    const pathMatch = req.path.match(/\/api\/v(\d+(?:\.\d+)?(?:-\w+)?)/);
    if (pathMatch) {
      return pathMatch[1];
    }

    return null;
  }

  private isVersionSupported(version: string): boolean {
    return this.supportedVersions.has(version);
  }

  private getLatestStableVersion(): string {
    const stableVersions = Array.from(this.supportedVersions.entries())
      .filter(([, info]) => !info.deprecated)
      .sort((a, b) => this.compareVersions(a[0], b[0]));

    return stableVersions[stableVersions.length - 1]?.[0] || "1.0";
  }

  /**
   * Compares two semantic version strings according to SemVer 2.0.0 specification.
   *
   * @param a - First version string
   * @param b - Second version string
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   *
   * This function implements proper SemVer comparison:
   * 1. Compares major.minor.patch numerically
   * 2. Treats stable versions (no prerelease) as greater than prerelease versions
   * 3. Compares prerelease identifiers according to SemVer rules:
   *    - Numeric identifiers < non-numeric identifiers
   *    - Numeric identifiers compared numerically
   *    - Non-numeric identifiers compared lexically
   */
  private compareVersions(a: string, b: string): number {
    // Parse version strings into components
    const parseVersion = (version: string) => {
      // Split on '-' or '+' to separate core version from prerelease/build metadata
      const [coreVersion, prerelease] = version.split(/[-+]/);

      // Parse core version (major.minor.patch)
      const coreParts = coreVersion.split(".").map(Number);
      const major = coreParts[0] || 0;
      const minor = coreParts[1] || 0;
      const patch = coreParts[2] || 0;

      return { major, minor, patch, prerelease };
    };

    const versionA = parseVersion(a);
    const versionB = parseVersion(b);

    // Compare major.minor.patch first
    if (versionA.major !== versionB.major) {
      return versionA.major - versionB.major;
    }
    if (versionA.minor !== versionB.minor) {
      return versionA.minor - versionB.minor;
    }
    if (versionA.patch !== versionB.patch) {
      return versionA.patch - versionB.patch;
    }

    // If core versions are equal, handle prerelease comparison
    const hasPrereleaseA = !!versionA.prerelease;
    const hasPrereleaseB = !!versionB.prerelease;

    // A version without prerelease is greater than one with prerelease
    if (!hasPrereleaseA && hasPrereleaseB) {
      return 1;
    }
    if (hasPrereleaseA && !hasPrereleaseB) {
      return -1;
    }

    // If both have prereleases, compare them lexically
    if (hasPrereleaseA && hasPrereleaseB) {
      return this.comparePrerelease(versionA.prerelease, versionB.prerelease);
    }

    // Both versions are equal (no prerelease)
    return 0;
  }

  /**
   * Compares two prerelease identifier strings according to SemVer 2.0.0 specification.
   *
   * @param a - First prerelease string
   * @param b - Second prerelease string
   * @returns -1 if a < b, 0 if a === b, 1 if a > b
   *
   * Prerelease comparison rules:
   * - Numeric identifiers have lower precedence than non-numeric
   * - Numeric identifiers are compared numerically
   * - Non-numeric identifiers are compared lexically
   * - Shorter prereleases are less than longer ones when prefixes match
   */
  private comparePrerelease(a: string, b: string): number {
    const partsA = a.split(".");
    const partsB = b.split(".");

    const maxLength = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLength; i++) {
      const partA = partsA[i];
      const partB = partsB[i];

      // If one part is missing, the shorter prerelease is less
      if (!partA && partB) return -1;
      if (partA && !partB) return 1;

      // If both parts exist, compare them
      if (partA && partB) {
        const isNumericA = /^\d+$/.test(partA);
        const isNumericB = /^\d+$/.test(partB);

        // Numeric identifiers have lower precedence than non-numeric
        if (isNumericA && !isNumericB) return -1;
        if (!isNumericA && isNumericB) return 1;

        // If both are numeric, compare as numbers
        if (isNumericA && isNumericB) {
          const numA = parseInt(partA, 10);
          const numB = parseInt(partB, 10);
          if (numA !== numB) {
            return numA - numB;
          }
        } else {
          // If both are non-numeric, compare lexically
          if (partA !== partB) {
            return partA.localeCompare(partB);
          }
        }
      }
    }

    return 0;
  }

  /**
   * Get supported API versions
   */
  getSupportedVersions(): ApiVersion[] {
    return Array.from(this.supportedVersions.values());
  }

  /**
   * Check if a version is deprecated
   */
  isVersionDeprecated(version: string): boolean {
    return this.supportedVersions.get(version)?.deprecated || false;
  }
}
