// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Enable validation globally
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  // Enable CORS for WebSocket connections
  app.enableCors({
    origin: configService.get('ALLOWED_ORIGINS')?.split(',') || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(configService.get('PORT') || 3000);
}
bootstrap();
