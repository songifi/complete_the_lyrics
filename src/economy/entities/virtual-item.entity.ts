import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn, UpdateDateColumn } from "typeorm"

export enum ItemType {
  CONSUMABLE = "consumable",
  EQUIPMENT = "equipment",
  MATERIAL = "material",
  COSMETIC = "cosmetic",
  CURRENCY_PACK = "currency_pack",
}

@Entity("virtual_items")
@Index(["name"], { unique: true })
@Index(["itemType"])
export class VirtualItem {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ length: 255, unique: true })
  name: string

  @Column({ length: 1000, nullable: true })
  description: string

  @Column({ type: "enum", enum: ItemType })
  itemType: ItemType

  @Column({ type: "numeric", precision: 18, scale: 4, default: "0.0000" })
  basePrice: string // Default price, can be overridden by market dynamics

  @Column({ length: 255, nullable: true })
  iconUrl: string

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any> // e.g., stats, effects, stackable: true/false

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
