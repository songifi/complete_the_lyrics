import { Injectable, Logger } from "@nestjs/common"
import type { ConfigService } from "@nestjs/config"
import * as admin from "firebase-admin"
import type { Notification } from "../entities/notification.entity"

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name)

  constructor(private configService: ConfigService) {
    this.initializeFirebase()
  }

  private initializeFirebase(): void {
    const serviceAccount = {
      projectId: this.configService.get("FIREBASE_PROJECT_ID"),
      privateKey: this.configService.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n"),
      clientEmail: this.configService.get("FIREBASE_CLIENT_EMAIL"),
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      })
    }
  }

  async sendNotification(notification: Notification): Promise<void> {
    try {
      const deviceTokens = await this.getUserDeviceTokens(notification.userId)

      if (deviceTokens.length === 0) {
        this.logger.warn(`No device tokens found for user ${notification.userId}`)
        return
      }

      const message = {
        notification: {
          title: notification.title,
          body: notification.content,
        },
        data: {
          notificationId: notification.id,
          category: notification.category,
          ...notification.metadata,
        },
        tokens: deviceTokens,
      }

      const response = await admin.messaging().sendMulticast(message)

      this.logger.log(`Push notification sent: ${response.successCount} successful, ${response.failureCount} failed`)

      // Handle failed tokens (remove invalid ones)
      if (response.failureCount > 0) {
        await this.handleFailedTokens(deviceTokens, response.responses)
      }
    } catch (error) {
      this.logger.error(`Failed to send push notification for ${notification.id}: ${error.message}`)
      throw error
    }
  }

  private async getUserDeviceTokens(userId: string): Promise<string[]> {
    // This should be implemented based on your user device token storage
    // For now, returning a placeholder
    return [`device-token-${userId}`]
  }

  private async handleFailedTokens(tokens: string[], responses: admin.messaging.SendResponse[]): Promise<void> {
    const failedTokens: string[] = []

    responses.forEach((response, index) => {
      if (!response.success) {
        const error = response.error
        if (
          error?.code === "messaging/invalid-registration-token" ||
          error?.code === "messaging/registration-token-not-registered"
        ) {
          failedTokens.push(tokens[index])
        }
      }
    })

    if (failedTokens.length > 0) {
      // Remove invalid tokens from your database
      this.logger.log(`Removing ${failedTokens.length} invalid device tokens`)
    }
  }
}
