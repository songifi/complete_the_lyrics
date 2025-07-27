import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from "typeorm"
import { GuildMember } from "./guild-member.entity"
import { GuildCompetition } from "./guild-competition.entity"
import { GuildAchievement } from "./guild-achievement.entity"

export enum GuildStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DISBANDED = "disbanded",
}

@Entity("guilds")
@Index(["name"], { unique: true })
@Index(["status"])
export class Guild {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ length: 100, unique: true })
  name: string

  @Column({ length: 500, nullable: true })
  description: string

  @Column({ length: 255, nullable: true })
  logo: string

  @Column({
    type: "enum",
    enum: GuildStatus,
    default: GuildStatus.ACTIVE,
  })
  status: GuildStatus

  @Column({ type: "int", default: 50 })
  maxMembers: number

  @Column({ type: "int", default: 0 })
  level: number

  @Column({ type: "int", default: 0 })
  experience: number

  @Column({ type: "jsonb", default: {} })
  settings: Record<string, any>

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any>

  // Self-referencing for guild hierarchies (parent guilds, sub-guilds)
  @ManyToOne(
    () => Guild,
    (guild) => guild.subGuilds,
    { nullable: true },
  )
  @JoinColumn({ name: "parent_guild_id" })
  parentGuild: Guild

  @OneToMany(
    () => Guild,
    (guild) => guild.parentGuild,
  )
  subGuilds: Guild[]

  @OneToMany(
    () => GuildMember,
    (member) => member.guild,
    { cascade: true },
  )
  members: GuildMember[]

  @OneToMany(
    () => GuildCompetition,
    (competition) => competition.guild,
  )
  competitions: GuildCompetition[]

  @OneToMany(
    () => GuildAchievement,
    (achievement) => achievement.guild,
  )
  achievements: GuildAchievement[]

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // Virtual properties
  get memberCount(): number {
    return this.members?.length || 0
  }

  get isAtCapacity(): boolean {
    return this.memberCount >= this.maxMembers
  }
}
