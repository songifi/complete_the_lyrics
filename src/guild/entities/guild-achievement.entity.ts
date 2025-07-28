import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from "typeorm"
import { Guild } from "./guild.entity"

export enum AchievementType {
  MILESTONE = "milestone",
  COMPETITION = "competition",
  ACTIVITY = "activity",
  SPECIAL = "special",
}

@Entity("guild_achievements")
@Index(["guildId", "type"])
@Index(["achievedAt"])
export class GuildAchievement {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "guild_id" })
  guildId: string

  @Column({ length: 200 })
  name: string

  @Column({ length: 500, nullable: true })
  description: string

  @Column({
    type: "enum",
    enum: AchievementType,
    default: AchievementType.MILESTONE,
  })
  type: AchievementType

  @Column({ length: 255, nullable: true })
  icon: string

  @Column({ type: "int", default: 0 })
  points: number

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any>

  @ManyToOne(
    () => Guild,
    (guild) => guild.achievements,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "guild_id" })
  guild: Guild

  @CreateDateColumn()
  achievedAt: Date
}
