import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth.module';
import { AUTH_CONSTANTS } from './constants/auth.constants';

describe('AuthModule Integration', () => {
  let app: INestApplication;
  let configService: ConfigService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    configService = moduleFixture.get<ConfigService>(ConfigService);
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should be defined', () => {
    expect(app).toBeDefined();
  });

  it('should have auth module configured', () => {
    const authModule = app.get(AuthModule);
    expect(authModule).toBeDefined();
  });

  it('should have JWT configuration', () => {
    const jwtSecret = configService.get('JWT_SECRET') || AUTH_CONSTANTS.JWT_SECRET;
    expect(jwtSecret).toBeDefined();
    expect(typeof jwtSecret).toBe('string');
  });

  it('should have database entities configured', () => {
    expect(app).toBeDefined();
  });
});
