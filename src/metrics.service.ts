import { Injectable } from '@nestjs/common';
import { ServerMetrics } from './server-metrics.entity';

@Injectable()
export class MetricsService {
  getMetrics(): ServerMetrics {
    // Dummy data for now
    return new ServerMetrics({
      cpuUsage: 10,
      memoryUsage: 20,
      diskUsage: 30,
      networkIn: 1000,
      networkOut: 800,
      status: 'healthy',
      timestamp: new Date(),
    });
  }
} 