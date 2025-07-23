export class ServerMetrics {
  cpuUsage: number; // percentage
  memoryUsage: number; // percentage
  diskUsage: number; // percentage
  networkIn: number; // bytes/sec
  networkOut: number; // bytes/sec
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;

  constructor(partial: Partial<ServerMetrics>) {
    Object.assign(this, partial);
  }
} 