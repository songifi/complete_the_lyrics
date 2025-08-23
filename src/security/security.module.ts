import {
  Module,
  Global,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SecurityService } from "./security.service";
import { CspService } from "./csp.service";
import { CspMiddleware } from "./csp.middleware";
import { CspHeaderMiddleware } from "./csp-header.middleware";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [SecurityService, CspService, CspMiddleware, CspHeaderMiddleware],
  exports: [SecurityService, CspService, CspMiddleware, CspHeaderMiddleware],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply middlewares in the correct order:
    // 1. CspMiddleware first to generate nonce
    // 2. CspHeaderMiddleware second to use the nonce for CSP headers
    consumer
      .apply(CspMiddleware, CspHeaderMiddleware)
      .forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
