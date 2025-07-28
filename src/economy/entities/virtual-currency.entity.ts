import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from "typeorm"

@Entity("virtual_currencies")
@Index(["userId", "currencyCode"], { unique: true })
@Index(["currencyCode"])
export class VirtualCurrency {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "user_id" })
  userId: string

  @Column({ length: 50 })
  currencyCode: string // e.g., 'GOLD', 'GEM', 'COIN'

  @Column({ type: "numeric", precision: 18, scale: 4, default: "0.0000" })
  balance: string // Use string for precise decimal arithmetic

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
