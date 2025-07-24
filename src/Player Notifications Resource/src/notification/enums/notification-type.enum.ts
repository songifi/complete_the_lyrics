export enum NotificationType {
  EMAIL = "email",
  PUSH = "push",
  SMS = "sms",
  IN_APP = "in_app",
  WEBHOOK = "webhook",
}

export enum NotificationCategory {
  SYSTEM = "system",
  MARKETING = "marketing",
  TRANSACTIONAL = "transactional",
  SOCIAL = "social",
  SECURITY = "security",
}

export enum NotificationPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent",
}

export enum NotificationStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed",
}
