import { IsString, IsEnum, IsOptional, IsObject, IsDateString, IsUUID } from "class-validator"
import { NotificationType, NotificationCategory, NotificationPriority } from "../enums/notification-type.enum"

export class CreateNotificationDto {
  @IsUUID()
  userId: string

  @IsEnum(NotificationType)
  type: NotificationType

  @IsEnum(NotificationCategory)
  category: NotificationCategory

  @IsEnum(NotificationPriority)
  @IsOptional()
  priority?: NotificationPriority

  @IsString()
  title: string

  @IsString()
  content: string

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>

  @IsObject()
  @IsOptional()
  templateData?: Record<string, any>

  @IsString()
  @IsOptional()
  templateId?: string

  @IsDateString()
  @IsOptional()
  scheduledAt?: Date
}
