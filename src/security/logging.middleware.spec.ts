import { LoggingMiddleware } from "./logging.middleware";
import { Request, Response, NextFunction } from "express";

// Mock logger interface
interface MockLogger {
  log: jest.MockedFunction<(...args: unknown[]) => void>;
  error: jest.MockedFunction<(...args: unknown[]) => void>;
}

// Extended mock response with proper typing
interface MockResponse extends Partial<Response> {
  statusCode: number;
  end: jest.MockedFunction<(...args: unknown[]) => Response>;
}

describe("LoggingMiddleware", () => {
  let middleware: LoggingMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: MockResponse;
  let mockNext: NextFunction;
  let mockLogger: MockLogger;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
    };

    // Create middleware with mocked logger
    middleware = new LoggingMiddleware();

    // Mock the private logger property using type assertion
    (middleware as unknown as { logger: MockLogger }).logger = mockLogger;

    mockRequest = {
      method: "POST",
      originalUrl: "/api/test",
      ip: "127.0.0.1",
      headers: {
        "user-agent": "TestAgent/1.0",
        "content-type": "application/json",
        authorization: "Bearer secret-token-123",
        "x-api-key": "api-key-456",
      },
    };

    mockResponse = {
      statusCode: 200,
      end: jest.fn(),
    };

    mockNext = jest.fn();
  });

  describe("default configuration", () => {
    it("should log incoming request with masked sensitive headers", () => {
      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        "Incoming POST request to /api/test",
        expect.objectContaining({
          headers: {
            "content-type": "application/json",
            authorization: "***",
            "x-api-key": "***",
          },
        }),
      );
    });

    it("should not log full error response body by default", () => {
      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Simulate error response
      const errorChunk = JSON.stringify({
        message: "Bad Request",
        code: "VALIDATION_ERROR",
        details: { email: "user@example.com", ssn: "123-45-6789" },
      });

      // Call the overridden end method
      mockResponse.end(errorChunk);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error response for POST /api/test",
        expect.objectContaining({
          error: {
            message: "Bad Request",
            code: "VALIDATION_ERROR",
            status: undefined,
          },
        }),
      );

      // Verify sensitive data is not logged
      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as {
        error: { message: string; code: string };
      };
      expect(JSON.stringify(errorData.error)).not.toContain("user@example.com");
      expect(JSON.stringify(errorData.error)).not.toContain("123-45-6789");
    });
  });

  describe("with body logging enabled", () => {
    beforeEach(() => {
      middleware = new LoggingMiddleware({ enableBodyLogging: true });
      (middleware as unknown as { logger: MockLogger }).logger = mockLogger;
    });

    it("should log full error response body with sanitization", () => {
      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      const errorChunk = JSON.stringify({
        message: "Bad Request",
        email: "user@example.com",
        ssn: "123-45-6789",
        creditCard: "1234-5678-9012-3456",
        token: "Bearer secret-token-123",
      });

      mockResponse.end(errorChunk);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error response for POST /api/test",
        expect.objectContaining({
          error: expect.stringContaining("[EMAIL]") as unknown,
        }),
      );

      // Verify sensitive data is masked
      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as { error: string };
      expect(errorData.error).toContain("[EMAIL]");
      expect(errorData.error).toContain("[SSN]");
      expect(errorData.error).toContain("[CREDIT_CARD]");
      expect(errorData.error).toContain("Bearer [TOKEN]");
    });
  });

  describe("custom configuration", () => {
    it("should respect custom maxLogLength", () => {
      middleware = new LoggingMiddleware({ maxLogLength: 50 });
      (middleware as unknown as { logger: MockLogger }).logger = mockLogger;

      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      const longErrorChunk = "x".repeat(100);
      mockResponse.end(longErrorChunk);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error response for POST /api/test",
        expect.objectContaining({
          error: expect.stringContaining("...") as unknown,
        }),
      );

      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as { error: string };
      expect(errorData.error).toHaveLength(53); // 50 chars + "..."
    });

    it("should respect custom safeErrorFields", () => {
      middleware = new LoggingMiddleware({
        safeErrorFields: ["message", "errorCode"],
      });
      (middleware as unknown as { logger: MockLogger }).logger = mockLogger;

      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      const errorChunk = JSON.stringify({
        message: "Bad Request",
        errorCode: "VALIDATION_ERROR",
        details: "sensitive details",
        status: 400,
      });

      mockResponse.end(errorChunk);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Error response for POST /api/test",
        expect.objectContaining({
          error: {
            message: "Bad Request",
            errorCode: "VALIDATION_ERROR",
          },
        }),
      );

      // Verify only specified fields are logged
      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as { error: Record<string, unknown> };
      expect(errorData.error).not.toHaveProperty("details");
      expect(errorData.error).not.toHaveProperty("status");
    });
  });

  describe("sanitization", () => {
    beforeEach(() => {
      middleware = new LoggingMiddleware({ enableBodyLogging: true });
      (middleware as unknown as { logger: MockLogger }).logger = mockLogger;
    });

    it("should mask email addresses", () => {
      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      const errorChunk = "User email@example.com failed to authenticate";
      mockResponse.end(errorChunk);

      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as { error: string };
      expect(errorData.error).toContain("[EMAIL]");
      expect(errorData.error).not.toContain("email@example.com");
    });

    it("should mask SSNs", () => {
      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      const errorChunk = "Invalid SSN: 123-45-6789";
      mockResponse.end(errorChunk);

      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as { error: string };
      expect(errorData.error).toContain("[SSN]");
      expect(errorData.error).not.toContain("123-45-6789");
    });

    it("should mask credit card numbers", () => {
      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      const errorChunk = "Invalid card: 1234-5678-9012-3456";
      mockResponse.end(errorChunk);

      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as { error: string };
      expect(errorData.error).toContain("[CREDIT_CARD]");
      expect(errorData.error).not.toContain("1234-5678-9012-3456");
    });

    it("should mask authorization tokens", () => {
      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      const errorChunk = "Bearer token123 expired";
      mockResponse.end(errorChunk);

      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as { error: string };
      expect(errorData.error).toContain("Bearer [TOKEN]");
      expect(errorData.error).not.toContain("token123");
    });
  });

  describe("Buffer handling", () => {
    beforeEach(() => {
      middleware = new LoggingMiddleware({ enableBodyLogging: true });
      (middleware as unknown as { logger: MockLogger }).logger = mockLogger;
    });

    it("should handle Buffer content correctly", () => {
      mockResponse.statusCode = 400;

      middleware.use(
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      const bufferContent = Buffer.from("Error: user@example.com not found");
      mockResponse.end(bufferContent);

      const errorCall = mockLogger.error.mock.calls[0];
      const errorData = errorCall[1] as { error: string };
      expect(errorData.error).toContain("[EMAIL]");
      expect(errorData.error).not.toContain("user@example.com");
    });
  });

  describe("type handling", () => {
    beforeEach(() => {
      middleware = new LoggingMiddleware({ enableBodyLogging: true });
      (middleware as unknown as { logger: MockLogger }).logger = mockLogger;
    });

    it("should handle various content types", () => {
      // Test different content types
      const testCases = [
        { content: "string content", expected: "string" },
        { content: 123, expected: "123" },
        { content: true, expected: "true" },
        { content: null, expected: null },
        { content: undefined, expected: undefined },
        { content: { key: "value" }, expected: "object" },
      ];

      testCases.forEach(({ content, expected }) => {
        // Create fresh response and middleware instance for each test case
        const freshResponse: MockResponse = {
          statusCode: 400,
          end: jest.fn(),
        };

        const freshMiddleware = new LoggingMiddleware({
          enableBodyLogging: true,
        });
        (freshMiddleware as unknown as { logger: MockLogger }).logger =
          mockLogger;

        // Clear logger mocks before each iteration
        mockLogger.error.mockClear();

        // Use fresh middleware and response
        freshMiddleware.use(
          mockRequest as Request,
          freshResponse as Response,
          mockNext,
        );

        // Call end once on the fresh response
        freshResponse.end(content);

        if (expected === "object") {
          expect(mockLogger.error).toHaveBeenCalledWith(
            "Error response for POST /api/test",
            expect.objectContaining({
              error: expect.stringContaining("key") as unknown,
            }),
          );
        } else if (expected !== null && expected !== undefined) {
          expect(mockLogger.error).toHaveBeenCalledWith(
            "Error response for POST /api/test",
            expect.objectContaining({
              error: expected,
            }),
          );
        }
      });
    });
  });
});
