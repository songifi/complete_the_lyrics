import { Injectable } from '@nestjs/common';
import { Worker } from 'worker_threads';
import * as path from 'path';

@Injectable()
export class WorkerService {
  private runWorker(type: string, payload: unknown): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const worker = new Worker(path.join(__dirname, '../workers/stats-calculation.worker.js'), {
        workerData: { type, payload },
      });

      worker.on('message', (result: { success: boolean; result: unknown; error: string }) => {
        if (result.success) {
          resolve(result.result);
        } else {
          reject(new Error(result.error));
        }
        void worker.terminate();
      });

      worker.on('error', (error) => {
        reject(error);
        void worker.terminate();
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Worker stopped with exit code ${code}`));
        }
      });
    });
  }

  async calculateRankings(data: unknown): Promise<unknown> {
    return this.runWorker('CALCULATE_RANKINGS', data);
  }

  async processBatchStats(data: unknown): Promise<unknown> {
    return this.runWorker('PROCESS_BATCH_STATS', data);
  }

  async generateAnalytics(data: unknown): Promise<unknown> {
    return this.runWorker('GENERATE_ANALYTICS', data);
  }
}
