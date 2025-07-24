import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"
import { NotificationType, NotificationCategory } from "../enums/notification-type.enum"

@Entity("notification_preferences")
@Index(["userId"])
export class NotificationPreference {
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

  @Column({ default: true })
  enabled: boolean

  @Column("json", { nullable: true })
  schedule: {
    startTime?: string
    endTime?: string
    timezone?: string
    daysOfWeek?: number[]
  }

  @Column({ default: 0 })
  frequency: number // minutes between notifications

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
