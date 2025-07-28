import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { IdempotencyKey } from '../entities/idempotency-key.entity';

export interface IdempotencyResult {
  status: string;
  responseData?: any;
  errorMessage?: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);

  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyRepository: Repository<IdempotencyKey>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async checkIdempotency(
    key: string,
    userId: string,
    operation: string,
    requestData: any,
  ): Promise<IdempotencyResult | null> {
    try {
      // First check Redis cache for fast lookup
      const cachedResult = await this.cacheManager.get<IdempotencyResult>(
        `idempotency:${key}`,
      );
      if (cachedResult) {
        this.logger.log(`Idempotency cache hit: ${key}`);
        return cachedResult;
      }

      // Check database
      const existingKey = await this.idempotencyRepository.findOne({
        where: { key },
      });

      if (!existingKey) {
        return null;
      }

      // Verify that the request data matches
      if (!this.isRequestDataEqual(existingKey.requestData, requestData)) {
        throw new Error('Request data mismatch for idempotency key');
      }

      // Check if key has expired
      if (existingKey.expiresAt < new Date()) {
        await this.idempotencyRepository.delete(existingKey.id);
        return null;
      }

      const result: IdempotencyResult = {
        status: existingKey.status,
        responseData: existingKey.responseData,
      };

      // Cache the result for faster future lookups
      await this.cacheManager.set(`idempotency:${key}`, result, 3600); // 1 hour TTL

      return result;
    } catch (error) {
      this.logger.error(`Failed to check idempotency: ${error.message}`);
      throw error;
    }
  }

  async storeRequest(
    key: string,
    userId: string,
    operation: string,
    requestData: any,
  ): Promise<void> {
    try {
      const idempotencyKey = this.idempotencyRepository.create({
        key,
        userId,
        operation,
        requestData,
        status: 'processing',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      await this.idempotencyRepository.save(idempotencyKey);

      // Also cache the processing status
      await this.cacheManager.set(
        `idempotency:${key}`,
        { status: 'processing' },
        3600,
      );

      this.logger.log(`Stored idempotency key: ${key}`);
    } catch (error) {
      this.logger.error(`Failed to store idempotency key: ${error.message}`);
      throw error;
    }
  }

  async storeResult(
    key: string,
    status: string,
    responseData?: any,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const existingKey = await this.idempotencyRepository.findOne({
        where: { key },
      });

      if (!existingKey) {
        this.logger.warn(
          `Idempotency key not found when storing result: ${key}`,
        );
        return;
      }

      existingKey.status = status;
      existingKey.responseData = responseData;

      await this.idempotencyRepository.save(existingKey);

      // Update cache
      const result: IdempotencyResult = {
        status,
        responseData,
        errorMessage,
      };
      await this.cacheManager.set(`idempotency:${key}`, result, 3600);

      this.logger.log(`Updated idempotency key result: ${key} (${status})`);
    } catch (error) {
      this.logger.error(`Failed to store idempotency result: ${error.message}`);
      throw error;
    }
  }

  async cleanupExpiredKeys(): Promise<void> {
    try {
      const result = await this.idempotencyRepository
        .createQueryBuilder()
        .delete()
        .from(IdempotencyKey)
        .where('expiresAt < :now', { now: new Date() })
        .execute();

      this.logger.log(`Cleaned up ${result.affected} expired idempotency keys`);
    } catch (error) {
      this.logger.error(`Failed to cleanup expired keys: ${error.message}`);
    }
  }

  private isRequestDataEqual(stored: any, incoming: any): boolean {
    // Simple deep comparison - in production, you might want to use a more robust solution
    return (
      JSON.stringify(this.sortObject(stored)) ===
      JSON.stringify(this.sortObject(incoming))
    );
  }

  private sortObject(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sortObject(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: any = {};

    for (const key of sortedKeys) {
      sortedObj[key] = this.sortObject(obj[key]);
    }

    return sortedObj;
  }
}
