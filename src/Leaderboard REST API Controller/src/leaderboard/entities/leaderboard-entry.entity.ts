import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";
import { User } from "../../users/entities/user.entity";

@Entity("leaderboard_entries")
@Index(["score"], { name: "idx_leaderboard_score" })
@Index(["userId", "leaderboardType"], { name: "idx_user_leaderboard_type" })
export class LeaderboardEntryEntity {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  user: User;

  @Column("decimal", { precision: 10, scale: 2 })
  score: number;

  @Column({
    type: "enum",
    enum: ["global", "friends", "weekly", "monthly", "all_time"],
    default: "global",
  })
  leaderboardType: string;

  @Column({ type: "int", default: 0 })
  rank: number;

  @Column({ type: "int", default: 0 })
  previousRank: number;

  @Column({ type: "json", nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
