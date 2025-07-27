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

export enum ListingStatus {
  ACTIVE = "active",
  SOLD = "sold",
  CANCELLED = "cancelled",
}

@Entity("market_listings")
@Index(["itemId", "listingStatus"])
@Index(["sellerId", "listingStatus"])
@Index(["price"])
export class MarketListing {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "item_id" })
  itemId: string

  @Column({ name: "seller_id" })
  sellerId: string

  @Column({ type: "int" })
  quantity: number

  @Column({ type: "numeric", precision: 18, scale: 4 })
  price: string // Price per unit

  @Column({ type: "enum", enum: ListingStatus, default: ListingStatus.ACTIVE })
  listingStatus: ListingStatus

  @Column({ length: 50 })
  currencyCode: string // Currency used for this listing

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any> // e.g., minimum bid, auction end time

  @ManyToOne(
    () => VirtualItem,
    (item) => item.id,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "item_id" })
  item: VirtualItem

  @CreateDateColumn()
  listedAt: Date

  @Column({ type: "timestamp", nullable: true })
  soldAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
