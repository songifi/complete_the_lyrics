import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
} from "../enums/notification-type.enum"

@Entity("notifications")
@Index(["userId", "status"])
@Index(["type", "category"])
@Index(["scheduledAt"])
export class Notification {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column()
  @Index()
  userId: string

  @Column({
    type: "enum",
    enum: NotificationType,
  })
  type: NotificationType

  @Column({
    type: "enum",
    enum: NotificationCategory,
  })
  category: NotificationCategory

  @Column({
    type: "enum",
    enum: NotificationPriority,
    default: NotificationPriority.MEDIUM,
  })
  priority: NotificationPriority

  @Column({
    type: "enum",
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus

  @Column()
  title: string

  @Column("text")
  content: string

  @Column("json", { nullable: true })
  metadata: Record<string, any>

  @Column("json", { nullable: true })
  templateData: Record<string, any>

  @Column({ nullable: true })
  templateId: string

  @Column({ nullable: true })
  scheduledAt: Date

  @Column({ nullable: true })
  sentAt: Date

  @Column({ nullable: true })
  deliveredAt: Date

  @Column({ nullable: true })
  readAt: Date

  @Column({ nullable: true })
  failureReason: string

  @Column({ default: 0 })
  retryCount: number

  @Column({ default: 3 })
  maxRetries: number

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
