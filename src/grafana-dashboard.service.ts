import { Injectable } from '@nestjs/common';

@Injectable()
export class GrafanaDashboardService {
  async getDashboardUrl(): Promise<string> {
    // Placeholder for Grafana API integration
    return 'http://localhost:3000/grafana/dashboard';
  }
} 
 