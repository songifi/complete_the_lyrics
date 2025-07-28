import { Injectable, type OnModuleInit } from "@nestjs/common"
import { Queue } from "bull"
import { VirtualCurrencyService } from "./virtual-currency.service"
import { TransactionType } from "../entities/transaction.entity"

export interface ProcessTransactionJob {
  type: TransactionType
  fromUserId?: string
  toUserId?: string
  currencyCode: string
  amount: string
  description?: string
  metadata?: Record<string, any>
}

@Injectable()
export class TransactionProcessorService implements OnModuleInit {
  private transactionQueue: Queue<ProcessTransactionJob>
  private virtualCurrencyService: VirtualCurrencyService

  constructor() {
    this.transactionQueue = new Queue<ProcessTransactionJob>("economy-transactions")
    this.virtualCurrencyService = new VirtualCurrencyService()
  }

  async onModuleInit() {
    // Define a job processor for the queue
    this.transactionQueue.process(async (job) => {
      const { type, fromUserId, toUserId, currencyCode, amount, description, metadata } = job.data
      console.log(`Processing transaction job: ${job.id} - Type: ${type}`)

      try {
        // This is a simplified example. In a real system, you'd have a more
        // robust way to dispatch based on transaction type.
        // For now, we'll assume all "transactions" here are balance updates.
        if (type === TransactionType.DEPOSIT) {
          await this.virtualCurrencyService.deposit(toUserId, currencyCode, amount, description, metadata)
        } else if (type === TransactionType.WITHDRAW) {
          await this.virtualCurrencyService.withdraw(fromUserId, currencyCode, amount, description, metadata)
        } else if (type === TransactionType.TRANSFER) {
          await this.virtualCurrencyService.transfer(fromUserId, toUserId, currencyCode, amount, description, metadata)
        } else {
          console.warn(`Unhandled transaction type in queue processor: ${type}`)
        }
        console.log(`Transaction job ${job.id} completed successfully.`)
      } catch (error) {
        console.error(`Error processing transaction job ${job.id}:`, error.message)
        // In a real system, you'd handle retries, dead-letter queues, etc.
        throw error // Re-throw to mark job as failed in Bull
      }
    })
  }

  async addTransactionToQueue(jobData: ProcessTransactionJob): Promise<void> {
    await this.transactionQueue.add(jobData, {
      attempts: 3, // Retry up to 3 times on failure
      backoff: { type: "exponential", delay: 1000 }, // Exponential backoff
    })
    console.log(`Added transaction to queue: ${jobData.type} - ${jobData.amount} ${jobData.currencyCode}`)
  }
}
