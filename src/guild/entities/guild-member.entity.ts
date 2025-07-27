import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from "typeorm"
import { Guild } from "./guild.entity"

export enum GuildRole {
  LEADER = "leader",
  OFFICER = "officer",
  VETERAN = "veteran",
  MEMBER = "member",
  RECRUIT = "recruit",
}

export enum MemberStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  BANNED = "banned",
  LEFT = "left",
}

@Entity("guild_members")
@Unique(["guildId", "userId"])
@Index(["guildId", "role"])
@Index(["userId"])
export class GuildMember {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ name: "guild_id" })
  guildId: string

  @Column({ name: "user_id" })
  userId: string

  @Column({
    type: "enum",
    enum: GuildRole,
    default: GuildRole.RECRUIT,
  })
  role: GuildRole

  @Column({
    type: "enum",
    enum: MemberStatus,
    default: MemberStatus.ACTIVE,
  })
  status: MemberStatus

  @Column({ type: "int", default: 0 })
  contributionPoints: number

  @Column({ type: "timestamp", nullable: true })
  lastActiveAt: Date

  @Column({ type: "jsonb", default: {} })
  permissions: Record<string, boolean>

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any>

  @ManyToOne(
    () => Guild,
    (guild) => guild.members,
    { onDelete: "CASCADE" },
  )
  @JoinColumn({ name: "guild_id" })
  guild: Guild

  @CreateDateColumn()
  joinedAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // Helper methods
  hasPermission(permission: string): boolean {
    return this.permissions[permission] === true
  }

  isLeader(): boolean {
    return this.role === GuildRole.LEADER
  }

  isOfficer(): boolean {
    return this.role === GuildRole.OFFICER
  }

  canManageMembers(): boolean {
    return this.isLeader() || this.isOfficer()
  }
}
