import Redis from 'ioredis';

export class RedisCacheService {
  private client: Redis;

  constructor() {
    this.client = new Redis();
  }

  async set(key: string, value: any, ttl?: number) {
    await this.client.set(key, JSON.stringify(value), 'EX', ttl || 3600);
  }

  async get(key: string) {
    const data = await this.client.get(key);
    return data ? JSON.parse(data) : null;
  }
}
