import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm"
import { VirtualItem } from "./virtual-item.entity"

@Entity("inventory_items")
@Index(["userId", "itemId"])
@Index(["userId"])
export class InventoryItem {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "user_id" })
  userId: string

  @Column({ name: "item_id" })
  itemId: string

  @Column({ type: "int", default: 1 })
  quantity: number

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any> // e.g., item durability, unique properties

  @ManyToOne(
    () => VirtualItem,
    (item) => item.id,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "item_id" })
  item: VirtualItem

  @CreateDateColumn()
  acquiredAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
