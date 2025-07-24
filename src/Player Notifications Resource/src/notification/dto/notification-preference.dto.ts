import { IsEnum, IsBoolean, IsOptional, IsObject, IsNumber, IsUUID } from "class-validator"
import { NotificationType, NotificationCategory } from "../enums/notification-type.enum"

export class CreateNotificationPreferenceDto {
  @IsUUID()
  userId: string

  @IsEnum(NotificationType)
  type: NotificationType

  @IsEnum(NotificationCategory)
  category: NotificationCategory

  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @IsObject()
  @IsOptional()
  schedule?: {
    startTime?: string
    endTime?: string
    timezone?: string
    daysOfWeek?: number[]
  }

  @IsNumber()
  @IsOptional()
  frequency?: number
}

export class UpdateNotificationPreferenceDto {
  @IsBoolean()
  @IsOptional()
  enabled?: boolean

  @IsObject()
  @IsOptional()
  schedule?: {
    startTime?: string
    endTime?: string
    timezone?: string
    daysOfWeek?: number[]
  }

  @IsNumber()
  @IsOptional()
  frequency?: number
}
