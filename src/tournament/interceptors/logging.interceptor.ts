import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, params, query, user } = request;
    const now = Date.now();

    const logData = {
      method,
      url,
      params,
      query,
      userId: user?.id || user?.sub,
      timestamp: new Date().toISOString(),
    };

    this.logger.log(`Incoming request: ${JSON.stringify(logData)}`);

    return next.handle().pipe(
      tap({
        next: (response) => {
          const duration = Date.now() - now;
          this.logger.log(
            `Request completed in ${duration}ms: ${method} ${url}`,
          );
        },
        error: (error) => {
          const duration = Date.now() - now;
          this.logger.error(
            `Request failed in ${duration}ms: ${method} ${url} - ${error.message}`,
            error.stack,
          );
        },
      }),
    );
  }
}
