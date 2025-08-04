import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisModuleOptions, RedisModuleOptionsFactory } from '@nestjs/redis';

@Injectable()
export class RedisConfigService implements RedisModuleOptionsFactory {
  constructor(private configService: ConfigService) {}

  createRedisModuleOptions(): RedisModuleOptions {
    return {
      config: {
        host: this.configService.get<string>('REDIS_HOST', 'localhost'),
        port: this.configService.get<number>('REDIS_PORT', 6379),
        password: this.configService.get<string>('REDIS_PASSWORD'),
        db: this.configService.get<number>('REDIS_DB', 0),
        retryDelayOnFailover: 100,
        retryDelayOnClusterDown: 300,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4,
        keyPrefix: this.configService.get<string>(
          'REDIS_KEY_PREFIX',
          'tournament:',
        ),
        connectTimeout: 10000,
        commandTimeout: 5000,
        onClientCreated: (client) => {
          client.on('error', (err) => {
            console.error('Redis Client Error:', err);
          });
          client.on('connect', () => {
            console.log('Redis Client Connected');
          });
          client.on('ready', () => {
            console.log('Redis Client Ready');
          });
          client.on('close', () => {
            console.log('Redis Client Connection Closed');
          });
        },
      },
    };
  }
}

export const redisConfig = {
  tournament: {
    ttl: 3600, // 1 hour
    prefix: 'tournament:',
  },
  match: {
    ttl: 1800, // 30 minutes
    prefix: 'match:',
  },
  bracket: {
    ttl: 900, // 15 minutes
    prefix: 'bracket:',
  },
  leaderboard: {
    ttl: 300, // 5 minutes
    prefix: 'leaderboard:',
  },
  participant: {
    ttl: 1800, // 30 minutes
    prefix: 'participant:',
  },
  state: {
    ttl: 3600, // 1 hour
    prefix: 'state:',
  },
  session: {
    ttl: 86400, // 24 hours
    prefix: 'session:',
  },
  rateLimit: {
    ttl: 60, // 1 minute
    prefix: 'rate_limit:',
  },
  lock: {
    ttl: 300, // 5 minutes
    prefix: 'lock:',
  },
};

export interface CacheOptions {
  ttl?: number;
  compress?: boolean;
  prefix?: string;
}

export const defaultCacheOptions: CacheOptions = {
  ttl: 3600,
  compress: true,
  prefix: 'default:',
};
