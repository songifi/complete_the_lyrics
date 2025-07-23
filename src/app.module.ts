import { Module } from '@nestjs/common';
import { MetricsModule } from './metrics.module';
import { LoggerModule } from './logger.module';
import { HealthModule } from './health.module';
import { APMModule } from './apm.module';

@Module({
  imports: [LoggerModule, MetricsModule, HealthModule, APMModule],
  controllers: [],
  providers: [],
})
export class AppModule {} 