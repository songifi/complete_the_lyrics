import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SeasonalEventModule } from '../seasonal-event.module';
import { SeasonalEventService } from '../services/seasonal-event.service';
import { SeasonalEventAnalyticsService } from '../services/seasonal-event-analytics.service';
import * as moment from 'moment-timezone';

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

// Mock WebSocketGateway
jest.mock('../gateways/seasonal-event.gateway', () => ({
  SeasonalEventGateway: jest.fn().mockImplementation(() => ({
    emitEventStatus: jest.fn(),
    emitParticipationUpdate: jest.fn(),
  })),
}));

describe('SeasonalEventModule (e2e)', () => {
  let app: INestApplication;
  let service: SeasonalEventService;
  let analytics: SeasonalEventAnalyticsService;

  beforeAll(async () => {
    jest.useFakeTimers();
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [SeasonalEventModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    service = moduleFixture.get(SeasonalEventService);
    analytics = moduleFixture.get(SeasonalEventAnalyticsService);
  });

  afterAll(async () => {
    await app.close();
    jest.useRealTimers();
  });

  it('should create and activate a seasonal event', async () => {
    // Simulate event creation and activation
    const now = moment().toDate();
    const event = await service['eventRepo'].create({
      name: 'Spring Festival',
      startTime: now,
      endTime: moment(now).add(1, 'day').toDate(),
      isActive: false,
      rewards: [{ type: 'badge', amount: 1 }],
    });
    await service['eventRepo'].save(event);
    await service.scheduleEvents();
    const updated = await service['eventRepo'].findOne({ where: { id: event.id } });
    expect(updated.isActive).toBe(true);
  });

  it('should track participation and completion', async () => {
    const userId = 'user1';
    const eventId = 'event1';
    await service.trackParticipation(userId, eventId);
    await service.processRewards(userId, eventId);
    const metrics = await analytics.getMetrics(eventId);
    expect(metrics.participants).toBeDefined();
    expect(metrics.completions).toBeDefined();
  });

  it('should claim rewards (pipe validation)', async () => {
    // Simulate reward claim with pipe
    const pipe = app.get('RewardCalculationPipe');
    const value = { eventId: 'event1', userId: 'user1' };
    const result = await pipe.transform(value);
    expect(result.calculatedRewards).toBeDefined();
  });
}); 