import { SetMetadata } from "@nestjs/common"
import type { NotificationType, NotificationCategory } from "../enums/notification-type.enum"

export interface NotificationTriggerOptions {
  type: NotificationType
  category: NotificationCategory
  template?: string
  delay?: number
  condition?: (context: any) => boolean
}

export const NOTIFICATION_TRIGGER_KEY = "notification_trigger"

export const NotificationTrigger = (options: NotificationTriggerOptions) =>
  SetMetadata(NOTIFICATION_TRIGGER_KEY, options)
