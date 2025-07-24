import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { DailyChallengeModule } from '../daily-challenge.module';
import { DailyChallengeService } from '../services/daily-challenge.service';
import { DailyChallengeAnalyticsService } from '../services/daily-challenge-analytics.service';

// Mock Redis and Bull for isolation
jest.mock('@nestjs/redis', () => ({ InjectRedis: () => () => {} }));
jest.mock('ioredis', () => jest.fn().mockImplementation(() => ({
  sadd: jest.fn(),
  expire: jest.fn(),
  scard: jest.fn().mockResolvedValue(1),
  get: jest.fn().mockResolvedValue('1'),
  incr: jest.fn(),
  hincrby: jest.fn(),
  hgetall: jest.fn().mockResolvedValue({}),
  set: jest.fn(),
  del: jest.fn(),
})));
jest.mock('@nestjs/bull', () => ({ InjectQueue: () => () => {} }));
jest.mock('bull', () => jest.fn().mockImplementation(() => ({ add: jest.fn() })));

describe('DailyChallengeModule (e2e)', () => {
  let app: INestApplication;
  let service: DailyChallengeService;
  let analytics: DailyChallengeAnalyticsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DailyChallengeModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    service = moduleFixture.get(DailyChallengeService);
    analytics = moduleFixture.get(DailyChallengeAnalyticsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate a daily challenge', async () => {
    await service.generateDailyChallenge();
    // No error means success
  });

  it('should submit progress and track participation', async () => {
    const userId = 'user1';
    const progress = { points: 1000 };
    const res = await request(app.getHttpServer())
      .post(`/daily-challenge/progress/${userId}`)
      .send(progress)
      .expect(201);
    expect(res.body.message).toBe('Progress submitted');
    // Participation tracked
    await analytics.trackParticipation(userId, new Date().toISOString().slice(0, 10));
  });

  it('should track completion and sharing', async () => {
    const userId = 'user1';
    await request(app.getHttpServer())
      .post(`/daily-challenge/complete/${userId}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/daily-challenge/share/${userId}`)
      .expect(201);
  });

  it('should fetch challenge metrics', async () => {
    const res = await request(app.getHttpServer())
      .get('/daily-challenge/metrics')
      .expect(200);
    expect(res.body).toHaveProperty('participants');
    expect(res.body).toHaveProperty('completions');
    expect(res.body).toHaveProperty('shares');
  });
}); 