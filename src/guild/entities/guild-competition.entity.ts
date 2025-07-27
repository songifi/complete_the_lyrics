import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { Guild } from "./guild.entity"

export enum CompetitionType {
  TOURNAMENT = "tournament",
  LEAGUE = "league",
  CHALLENGE = "challenge",
  EVENT = "event",
}

export enum CompetitionStatus {
  UPCOMING = "upcoming",
  ACTIVE = "active",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

@Entity("guild_competitions")
@Index(["guildId", "status"])
@Index(["startDate", "endDate"])
export class GuildCompetition {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "guild_id" })
  guildId: string

  @Column({ length: 200 })
  name: string

  @Column({ length: 1000, nullable: true })
  description: string

  @Column({
    type: "enum",
    enum: CompetitionType,
    default: CompetitionType.TOURNAMENT,
  })
  type: CompetitionType

  @Column({
    type: "enum",
    enum: CompetitionStatus,
    default: CompetitionStatus.UPCOMING,
  })
  status: CompetitionStatus

  @Column({ type: "timestamp" })
  startDate: Date

  @Column({ type: "timestamp" })
  endDate: Date

  @Column({ type: "int", default: 0 })
  maxParticipants: number

  @Column({ type: "jsonb", default: {} })
  rules: Record<string, any>

  @Column({ type: "jsonb", default: {} })
  rewards: Record<string, any>

  @Column({ type: "jsonb", default: {} })
  results: Record<string, any>

  @ManyToOne(
    () => Guild,
    (guild) => guild.competitions,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "guild_id" })
  guild: Guild

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
