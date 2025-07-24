import { Processor, Process } from "@nestjs/bull"
import type { Job } from "bull"
import { Logger } from "@nestjs/common"
import type { NotificationService } from "../services/notification.service"

@Processor("notification")
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name)

  constructor(private notificationService: NotificationService) {}

  @Process("send-notification")
  async handleSendNotification(job: Job<{ notificationId: string }>) {
    const { notificationId } = job.data

    this.logger.log(`Processing notification job: ${notificationId}`)

    try {
      await this.notificationService.sendNotification(notificationId)
      this.logger.log(`Successfully processed notification: ${notificationId}`)
    } catch (error) {
      this.logger.error(`Failed to process notification ${notificationId}: ${error.message}`)
      throw error
    }
  }

  @Process("cleanup-old-notifications")
  async handleCleanup(job: Job) {
    this.logger.log("Starting notification cleanup job")

    try {
      // Implement cleanup logic for old notifications
      // This is a placeholder for the actual implementation
      this.logger.log("Notification cleanup completed")
    } catch (error) {
      this.logger.error(`Notification cleanup failed: ${error.message}`)
      throw error
    }
  }
}
