import { Test, type TestingModule } from "@nestjs/testing"
import type { INestApplication } from "@nestjs/common"
import * as request from "supertest"
import { AppModule } from "../src/app.module"
import { AnalyticsService } from "../src/analytics/services/analytics.service"

describe('Analytics System (e2e)', () => {
  let app: INestApplication;
  let analyticsService: AnalyticsService;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    analyticsService = moduleFixture.get<AnalyticsService>(AnalyticsService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Event Tracking', () => {
    it('should track analytics events', async () => {
      const eventData = {
        playerId: 'test-player-1',
        sessionId: 'test-session-1',
        eventType: 'level_completed',
        eventData: { level: 1, score: 1000 },
        value: 10,
        platform: 'web',
      };

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            mutation TrackEvent($input: TrackEventInput!) {
              trackEvent(input: $input) {
                id
                playerId
                eventType
                value
              }
            }
          `,
          variables: { input: eventData },
        })
        .expect(200);

      expect(response.body.data.trackEvent).toBeDefined();
      expect(response.body.data.trackEvent.playerId).toBe(eventData.playerId);
      expect(response.body.data.trackEvent.eventType).toBe(eventData.eventType);
    });

    it('should handle high-volume event tracking', async () => {
      const events = Array.from({ length: 1000 }, (_, i) => ({
        playerId: `player-${i % 100}`,
        sessionId: `session-${i}`,
        eventType: 'click',
        eventData: { button: 'play' },
        platform: 'mobile',
      }));

      const startTime = Date.now();
      
      const promises = events.map(event =>
        analyticsService.trackEvent(event)
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  describe('Real-time Metrics', () => {
    it('should provide real-time dashboard metrics', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: `
            query GetDashboardMetrics($days: Int!) {
              getDashboardMetrics(days: $days)
