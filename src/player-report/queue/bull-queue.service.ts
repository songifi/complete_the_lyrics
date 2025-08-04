import { Queue, Job } from 'bull';

export class BullQueueService {
  private queue: Queue;

  constructor(queueName: string) {
    this.queue = new Queue(queueName);
  }

  async addJob(data: any) {
    return await this.queue.add(data);
  }

  process(handler: (job: Job) => Promise<void>) {
    this.queue.process(handler);
  }
}
