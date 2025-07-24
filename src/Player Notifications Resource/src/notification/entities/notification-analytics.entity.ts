import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm"
import { NotificationType, NotificationCategory } from "../enums/notification-type.enum"

@Entity("notification_analytics")
@Index(["date", "type"])
@Index(["userId"])
export class NotificationAnalytics {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "date" })
  @Index()
  date: Date

  @Column({ nullable: true })
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

  @Column({ default: 0 })
  sent: number

  @Column({ default: 0 })
  delivered: number

  @Column({ default: 0 })
  opened: number

  @Column({ default: 0 })
  clicked: number

  @Column({ default: 0 })
  failed: number

  @CreateDateColumn()
  createdAt: Date
}
