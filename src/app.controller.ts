import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus'

@Controller()
export class AppController {
  constructor(private readonly appService: AppService,
     private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
  @Get("/health")
  @HealthCheck()
  async check() {
    return this.health.check([
      async () => this.db.pingCheck('database'),
    ]);
  }
}
