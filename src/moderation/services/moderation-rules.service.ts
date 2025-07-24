import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs/redis';
import { Redis } from 'ioredis';
import { ModerationRule } from '../entities/moderation-rule.entity';
import { ContentType } from '../../common/enums/content-type.enum';

@Injectable()
export class ModerationRulesService {
  private readonly logger = new Logger(ModerationRulesService.name);
  private readonly CACHE_PREFIX = 'moderation:rules:';
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRepository(ModerationRule)
    private readonly ruleRepository: Repository<ModerationRule>,
    @InjectRedis()
    private readonly redis: Redis,
  ) {}

  async getRulesForContentType(
    contentType: ContentType,
  ): Promise<ModerationRule[]> {
    const cacheKey = `${this.CACHE_PREFIX}${contentType}`;

    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      this.logger.warn('Failed to retrieve rules from cache:', error);
    }

    const rules = await this.ruleRepository.find({
      where: {
        applicableContentType: contentType,
        isActive: true,
      },
      order: { priority: 'DESC' },
    });

    try {
      await this.redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(rules));
    } catch (error) {
      this.logger.warn('Failed to cache rules:', error);
    }

    return rules;
  }

  async createRule(ruleData: Partial<ModerationRule>): Promise<ModerationRule> {
    const rule = this.ruleRepository.create(ruleData);
    const savedRule = await this.ruleRepository.save(rule);

    // Invalidate cache
    await this.invalidateCache();

    return savedRule;
  }

  async updateRule(
    id: string,
    updates: Partial<ModerationRule>,
  ): Promise<ModerationRule> {
    await this.ruleRepository.update(id, updates);
    const updatedRule = await this.ruleRepository.findOne({ where: { id } });

    // Invalidate cache
    await this.invalidateCache();

    return updatedRule;
  }

  async deleteRule(id: string): Promise<void> {
    await this.ruleRepository.update(id, { isActive: false });
    await this.invalidateCache();
  }

  private async invalidateCache(): Promise<void> {
    try {
      const keys = await this.redis.keys(`${this.CACHE_PREFIX}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      this.logger.warn('Failed to invalidate cache:', error);
    }
  }
}
