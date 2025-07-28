import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { IdempotencyService } from '../services/idempotency.service';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  private readonly logger = new Logger(IdempotencyGuard.name);

  constructor(private readonly idempotencyService: IdempotencyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    // Idempotency key is optional for GET requests
    if (request.method === 'GET') {
      return true;
    }

    // For POST, PUT, PATCH operations, check if idempotency key is provided
    if (!idempotencyKey) {
      // Idempotency key is recommended but not required for all operations
      // You can make it required by uncommenting the following line:
      // throw new BadRequestException('Idempotency-Key header is required');
      return true;
    }

    // Validate idempotency key format
    if (!this.isValidIdempotencyKey(idempotencyKey)) {
      throw new BadRequestException('Invalid idempotency key format');
    }

    const user = request.user;
    const operation = this.getOperationName(request);

    try {
      // Check if this operation has already been processed
      const existingResult = await this.idempotencyService.checkIdempotency(
        idempotencyKey,
        user?.id,
        operation,
        request.body,
      );

      if (existingResult) {
        if (existingResult.status === 'completed') {
          // Return the cached result
          const response = context.switchToHttp().getResponse();
          response.status(200).json({
            ...existingResult.responseData,
            _idempotent: true,
          });
          return false; // Stop processing, we've already sent the response
        } else if (existingResult.status === 'processing') {
          throw new ConflictException('Request is currently being processed');
        } else if (existingResult.status === 'failed') {
          throw new ConflictException(
            'Previous request with this idempotency key failed',
          );
        }
      }

      // Store the request for processing
      await this.idempotencyService.storeRequest(
        idempotencyKey,
        user?.id,
        operation,
        request.body,
      );

      // Add idempotency key to request for use in controllers
      request.idempotencyKey = idempotencyKey;

      this.logger.log(
        `Idempotency key processed: ${idempotencyKey} for operation: ${operation}`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Idempotency check failed: ${error.message}`);
      throw error;
    }
  }

  private isValidIdempotencyKey(key: string): boolean {
    // Idempotency key should be:
    // - Between 1 and 255 characters
    // - Contain only alphanumeric characters, hyphens, and underscores
    const pattern = /^[a-zA-Z0-9_-]{1,255}$/;
    return pattern.test(key);
  }

  private getOperationName(request: any): string {
    const { method, path } = request;
    return `${method}_${path.replace(/\//g, '_')}`;
  }
}
