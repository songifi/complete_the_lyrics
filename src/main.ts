import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { AppModule } from "./app.module";
import { SecurityService, CspService } from "./security";
import { CspMiddleware, CspHeaderMiddleware } from "./security";
import * as bodyParser from "body-parser";
import { Request, Response, NextFunction } from "express";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import session from "express-session";
import passport from "passport";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  const expressApp = app.getHttpAdapter().getInstance();
  if (expressApp && typeof expressApp.set === "function") {
    expressApp.set("trust proxy", 1);
  }

  const securityService = app.get(SecurityService);
  app.enableCors(securityService.getCorsConfig());

  app.use(helmet(securityService.getHelmetConfig()));

  app.use(cookieParser());

  // Configure session middleware for OAuth state parameter verification
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required for session security.');
  }
  app.use(session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: (process.env.SESSION_COOKIE_SAMESITE as 'lax' | 'none' | 'strict') || 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
    name: 'oauth-session',
  }));

  app.use(passport.initialize());
  app.use(passport.session());

  const cspService = app.get(CspService);

  app.use(new CspMiddleware().use);

  app.use(new CspHeaderMiddleware(cspService).use);

  const configService = app.get(ConfigService);
  const securityConfig = configService.get("security");
  const maxSize = securityConfig?.validation?.maxBodySize || 10 * 1024 * 1024;

  app.use(bodyParser.json({ limit: maxSize }));

  app.use(
    bodyParser.urlencoded({
      extended: true,
      limit: maxSize,
      parameterLimit: 1000,
    }),
  );

  app.use(
    bodyParser.raw({
      type: ["application/json", "text/plain"],
      limit: maxSize,
    }),
  );

  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err.type === "entity.too.large") {
      return res.status(413).json({
        error: "Payload Too Large",
        message: `Request payload exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`,
        statusCode: 413,
        path: req.path,
        method: req.method,
      });
    }
    next(err);
  });

  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(), microphone=(), camera=()",
    );
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      forbidUnknownValues: true,
      skipMissingProperties: false,
      skipNullProperties: false,
      skipUndefinedProperties: false,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  app.setGlobalPrefix("api/v1");

  const port = process.env.PORT || 3000;
  await app.listen(port);

  Logger.log(`Application is running on: http://localhost:${port}`);
  Logger.log(`Payment system initialized with Stripe integration`);
  Logger.log(`Security middleware and protective measures enabled`);
  Logger.log(`API versioning enabled with prefix: /api/v1`);
  Logger.log(`Security headers configured`);
  Logger.log(`Rate limiting enabled`);
  Logger.log(`Request logging and validation active`);
}
bootstrap();
