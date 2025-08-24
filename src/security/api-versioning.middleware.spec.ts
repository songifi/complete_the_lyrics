import { Test, TestingModule } from "@nestjs/testing";
import { ApiVersioningMiddleware } from "./api-versioning.middleware";
import { Request, Response, NextFunction } from "express";

describe("ApiVersioningMiddleware", () => {
  let middleware: ApiVersioningMiddleware;
  let mockRequest: Partial<Request> & { apiVersion?: string };
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ApiVersioningMiddleware],
    }).compile();

    middleware = module.get<ApiVersioningMiddleware>(ApiVersioningMiddleware);

    mockRequest = {
      path: "/api/test",
      ip: "127.0.0.1",
      get: jest.fn(),
      query: {},
    };

    mockResponse = {
      setHeader: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe("compareVersions", () => {
    // Test the private method by accessing it through reflection or making it public for testing
    const compareVersions = (a: string, b: string) => {
      return (
        middleware as unknown as {
          compareVersions(a: string, b: string): number;
        }
      ).compareVersions(a, b);
    };

    describe("core version comparison", () => {
      it("should compare major versions correctly", () => {
        expect(compareVersions("2.0", "1.0")).toBeGreaterThan(0);
        expect(compareVersions("1.0", "2.0")).toBeLessThan(0);
        expect(compareVersions("1.0", "1.0")).toBe(0);
      });

      it("should compare minor versions correctly", () => {
        expect(compareVersions("1.2", "1.1")).toBeGreaterThan(0);
        expect(compareVersions("1.1", "1.2")).toBeLessThan(0);
        expect(compareVersions("1.1", "1.1")).toBe(0);
      });

      it("should compare patch versions correctly", () => {
        expect(compareVersions("1.1.2", "1.1.1")).toBeGreaterThan(0);
        expect(compareVersions("1.1.1", "1.1.2")).toBeLessThan(0);
        expect(compareVersions("1.1.1", "1.1.1")).toBe(0);
      });

      it("should handle missing patch version", () => {
        expect(compareVersions("1.1", "1.1.0")).toBe(0);
        expect(compareVersions("1.1.0", "1.1")).toBe(0);
      });
    });

    describe("prerelease comparison", () => {
      it("should treat stable version as greater than prerelease", () => {
        expect(compareVersions("1.0", "1.0-beta")).toBeGreaterThan(0);
        expect(compareVersions("1.0", "1.0-alpha")).toBeGreaterThan(0);
        expect(compareVersions("1.0", "1.0-rc")).toBeGreaterThan(0);
      });

      it("should treat prerelease as less than stable version", () => {
        expect(compareVersions("1.0-beta", "1.0")).toBeLessThan(0);
        expect(compareVersions("1.0-alpha", "1.0")).toBeLessThan(0);
        expect(compareVersions("1.0-rc", "1.0")).toBeLessThan(0);
      });

      it("should compare prerelease versions correctly", () => {
        // alpha < beta < rc
        expect(compareVersions("1.0-alpha", "1.0-beta")).toBeLessThan(0);
        expect(compareVersions("1.0-beta", "1.0-rc")).toBeLessThan(0);
        expect(compareVersions("1.0-rc", "1.0-alpha")).toBeGreaterThan(0);
      });

      it("should handle numeric prerelease identifiers", () => {
        expect(compareVersions("1.0-alpha.1", "1.0-alpha.2")).toBeLessThan(0);
        expect(compareVersions("1.0-alpha.10", "1.0-alpha.2")).toBeGreaterThan(
          0,
        );
        expect(compareVersions("1.0-alpha.1", "1.0-alpha.1")).toBe(0);
      });

      it("should handle mixed numeric and non-numeric prerelease identifiers", () => {
        // Numeric identifiers have lower precedence than non-numeric
        expect(compareVersions("1.0-alpha.1", "1.0-alpha.beta")).toBeLessThan(
          0,
        );
        expect(
          compareVersions("1.0-alpha.beta", "1.0-alpha.1"),
        ).toBeGreaterThan(0);
      });

      it("should handle complex prerelease strings", () => {
        expect(
          compareVersions("1.0-alpha.1.beta.2", "1.0-alpha.1.beta.3"),
        ).toBeLessThan(0);
        expect(
          compareVersions("1.0-alpha.1.beta", "1.0-alpha.1.beta.1"),
        ).toBeLessThan(0);
      });
    });

    describe("edge cases", () => {
      it("should handle empty strings gracefully", () => {
        expect(compareVersions("", "")).toBe(0);
        expect(compareVersions("1.0", "")).toBeGreaterThan(0);
        expect(compareVersions("", "1.0")).toBeLessThan(0);
      });

      it("should handle malformed version strings", () => {
        expect(compareVersions("invalid", "1.0")).toBe(0); // Both parse to 0.0.0
        expect(compareVersions("1.0", "invalid")).toBe(0); // Both parse to 0.0.0
      });

      it("should handle versions with build metadata (ignored)", () => {
        expect(compareVersions("1.0+build.1", "1.0+build.2")).toBe(0);
        expect(compareVersions("1.0+build.1", "1.0")).toBe(0);
      });
    });
  });

  describe("getLatestStableVersion", () => {
    it("should return the highest stable version", () => {
      const latestVersion = (
        middleware as unknown as { getLatestStableVersion(): string }
      ).getLatestStableVersion();
      expect(latestVersion).toBe("2.0");
    });

    it("should exclude deprecated versions from consideration", () => {
      // The middleware has "1.0-beta" as deprecated, so it should not be considered
      const latestVersion = (
        middleware as unknown as { getLatestStableVersion(): string }
      ).getLatestStableVersion();
      expect(latestVersion).not.toBe("1.0-beta");
    });
  });

  describe("middleware functionality", () => {
    it("should set API version in request object", () => {
      (mockRequest.get as jest.Mock).mockReturnValue("1.0");

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.apiVersion).toBe("1.0");
    });

    it("should use latest stable version when no version specified", () => {
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockRequest.apiVersion).toBe("2.0");
    });

    it("should throw error for unsupported version", () => {
      (mockRequest.get as jest.Mock).mockReturnValue("3.0");

      expect(() => {
        middleware.use(
          mockRequest as Request,
          mockResponse as Response,
          mockNext,
        );
      }).toThrow("Unsupported API Version");
    });

    it("should add deprecation headers for deprecated versions", () => {
      (mockRequest.get as jest.Mock).mockReturnValue("1.0-beta");

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-API-Deprecated",
        "true",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-API-Sunset-Date",
        "2024-12-31",
      );
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        "X-API-Alternative",
        "1.0",
      );
    });
  });
});
