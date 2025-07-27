import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from "typeorm"

export enum TransactionType {
  DEPOSIT = "deposit",
  WITHDRAW = "withdraw",
  TRANSFER = "transfer",
  BUY_ITEM = "buy_item",
  SELL_ITEM = "sell_item",
  MARKETPLACE_FEE = "marketplace_fee",
  EARN_REWARD = "earn_reward",
  SPEND_COST = "spend_cost",
}

@Entity("transactions")
@Index(["currencyCode", "createdAt"])
@Index(["fromAccountId"])
@Index(["toAccountId"])
@Index(["transactionType"])
export class Transaction {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "enum", enum: TransactionType })
  transactionType: TransactionType

  @Column({ length: 50 })
  currencyCode: string

  @Column({ type: "numeric", precision: 18, scale: 4 })
  amount: string // Use string for precise decimal arithmetic

  @Column({ name: "from_account_id", nullable: true })
  fromAccountId: string // User ID or System Account ID (e.g., 'SYSTEM_EARNINGS', 'MARKETPLACE_ESCROW')

  @Column({ name: "to_account_id", nullable: true })
  toAccountId: string // User ID or System Account ID

  @Column({ length: 500, nullable: true })
  description: string

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any> // Additional context for the transaction

  @CreateDateColumn()
  createdAt: Date
}
