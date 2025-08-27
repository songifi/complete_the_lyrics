import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from "typeorm";

@Entity("leaderboard_history")
@Index(["userId", "period", "date"], { name: "idx_user_period_date" })
export class LeaderboardHistoryEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column("decimal", { precision: 10, scale: 2 })
  score: number;

  @Column({ type: "int" })
  rank: number;

  @Column({
    type: "enum",
    enum: ["daily", "weekly", "monthly", "yearly", "all_time"],
  })
  period: string;

  @Column({ type: "date" })
  date: string;

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
