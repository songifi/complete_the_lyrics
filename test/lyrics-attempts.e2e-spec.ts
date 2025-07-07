import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Lyrics & Attempts E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/lyrics (POST) should create lyrics', async () => {
    const res = await request(app.getHttpServer())
      .post('/lyrics')
      .send({ text: 'Some lyrics', answer: 'The answer' })
      .expect(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.text).toBe('Some lyrics');
    expect(res.body.answer).toBe('The answer');
  });

  it('/attempts (POST) should evaluate attempt', async () => {
    const res = await request(app.getHttpServer())
      .post('/attempts')
      .send({ lyricsId: 1, userAnswer: 'The answer' })
      .expect(201);
    expect(res.body).toHaveProperty('correct');
    expect(typeof res.body.correct).toBe('boolean');
  });
});
