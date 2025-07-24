import { Injectable, Logger } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import type { Notification } from "../entities/notification.entity"
import type { NotificationPreference } from "../entities/notification-preference.entity"
import type { NotificationAnalytics } from "../entities/notification-analytics.entity"
import type { CreateNotificationDto } from "../dto/create-notification.dto"
import { NotificationStatus, NotificationType } from "../enums/notification-type.enum"
import type { EmailService } from "./email.service"
import type { PushNotificationService } from "./push-notification.service"
import type { NotificationGateway } from "../gateways/notification.gateway"
import type { CacheService } from "./cache.service"
import { Between } from "typeorm"

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name)

  constructor(
    private notificationRepository: Repository<Notification>,
    private preferenceRepository: Repository<NotificationPreference>,
    private analyticsRepository: Repository<NotificationAnalytics>,
    private notificationQueue: Queue,
    private emailService: EmailService,
    private pushNotificationService: PushNotificationService,
    private notificationGateway: NotificationGateway,
    private cacheService: CacheService,
  ) {}

  async create(createNotificationDto: CreateNotificationDto): Promise<Notification> {
    // Check user preferences
    const canSend = await this.checkUserPreferences(
      createNotificationDto.userId,
      createNotificationDto.type,
      createNotificationDto.category,
    )

    if (!canSend) {
      this.logger.log(`Notification blocked by user preferences: ${createNotificationDto.userId}`)
      return null
    }

    const notification = this.notificationRepository.create(createNotificationDto)
    const savedNotification = await this.notificationRepository.save(notification)

    // Schedule or send immediately
    if (savedNotification.scheduledAt) {
      await this.scheduleNotification(savedNotification)
    } else {
      await this.sendNotification(savedNotification.id)
    }

    return savedNotification
  }

  async sendNotification(notificationId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    })

    if (!notification) {
      throw new Error("Notification not found")
    }

    try {
      switch (notification.type) {
        case NotificationType.EMAIL:
          await this.emailService.sendNotification(notification)
          break
        case NotificationType.PUSH:
          await this.pushNotificationService.sendNotification(notification)
          break
        case NotificationType.IN_APP:
          await this.notificationGateway.sendToUser(notification.userId, notification)
          break
        default:
          throw new Error(`Unsupported notification type: ${notification.type}`)
      }

      await this.updateNotificationStatus(notificationId, NotificationStatus.SENT)
      await this.updateAnalytics(notification, "sent")
    } catch (error) {
      this.logger.error(`Failed to send notification ${notificationId}: ${error.message}`)
      await this.handleNotificationFailure(notification, error.message)
    }
  }

  async scheduleNotification(notification: Notification): Promise<void> {
    const delay = notification.scheduledAt.getTime() - Date.now()

    if (delay > 0) {
      await this.notificationQueue.add("send-notification", { notificationId: notification.id }, { delay })
    } else {
      await this.sendNotification(notification.id)
    }
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.notificationRepository.update(notificationId, {
      status: NotificationStatus.READ,
      readAt: new Date(),
    })

    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    })

    if (notification) {
      await this.updateAnalytics(notification, "opened")
    }
  }

  async getUserNotifications(
    userId: string,
    page = 1,
    limit = 20,
  ): Promise<{ notifications: Notification[]; total: number }> {
    const [notifications, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: "DESC" },
      skip: (page - 1) * limit,
      take: limit,
    })

    return { notifications, total }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: {
        userId,
        status: NotificationStatus.SENT,
      },
    })
  }

  private async checkUserPreferences(userId: string, type: NotificationType, category: string): Promise<boolean> {
    const cacheKey = `preferences:${userId}:${type}:${category}`
    const cached = await this.cacheService.get(cacheKey)

    if (cached !== null) {
      return cached === "true"
    }

    const preference = await this.preferenceRepository.findOne({
      where: { userId, type, category: category as any },
    })

    const canSend = preference ? preference.enabled : true
    await this.cacheService.set(cacheKey, canSend.toString(), 300) // Cache for 5 minutes

    return canSend
  }

  private async updateNotificationStatus(notificationId: string, status: NotificationStatus): Promise<void> {
    const updateData: any = { status }

    if (status === NotificationStatus.SENT) {
      updateData.sentAt = new Date()
    } else if (status === NotificationStatus.DELIVERED) {
      updateData.deliveredAt = new Date()
    }

    await this.notificationRepository.update(notificationId, updateData)
  }

  private async handleNotificationFailure(notification: Notification, reason: string): Promise<void> {
    const retryCount = notification.retryCount + 1

    if (retryCount < notification.maxRetries) {
      // Schedule retry with exponential backoff
      const delay = Math.pow(2, retryCount) * 60000 // 2^n minutes

      await this.notificationRepository.update(notification.id, {
        retryCount,
        failureReason: reason,
      })

      await this.notificationQueue.add("send-notification", { notificationId: notification.id }, { delay })
    } else {
      await this.notificationRepository.update(notification.id, {
        status: NotificationStatus.FAILED,
        failureReason: reason,
        retryCount,
      })

      await this.updateAnalytics(notification, "failed")
    }
  }

  private async updateAnalytics(
    notification: Notification,
    action: "sent" | "delivered" | "opened" | "clicked" | "failed",
  ): Promise<void> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    let analytics = await this.analyticsRepository.findOne({
      where: {
        date: today,
        userId: notification.userId,
        type: notification.type,
        category: notification.category,
      },
    })

    if (!analytics) {
      analytics = this.analyticsRepository.create({
        date: today,
        userId: notification.userId,
        type: notification.type,
        category: notification.category,
      })
    }

    analytics[action]++
    await this.analyticsRepository.save(analytics)
  }

  async getAnalytics(userId?: string, startDate?: Date, endDate?: Date): Promise<NotificationAnalytics[]> {
    const where: any = {}

    if (userId) {
      where.userId = userId
    }

    if (startDate && endDate) {
      where.date = Between(startDate, endDate)
    }

    return this.analyticsRepository.find({
      where,
      order: { date: "DESC" },
    })
  }
}
