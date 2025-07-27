import { Injectable } from "@nestjs/common"
import { OnEvent } from "@nestjs/event-emitter"
import type { GuildCacheService } from "../services/guild-cache.service"

@Injectable()
export class GuildEventListener {
  constructor(private guildCacheService: GuildCacheService) {}

  @OnEvent("guild.created")
  async handleGuildCreated(payload: any) {
    console.log("Guild created:", payload.guild.name)

    // Log activity
    await this.guildCacheService.cacheGuildActivity(payload.guild.id, {
      type: "guild_created",
      timestamp: new Date(),
      data: {
        guildName: payload.guild.name,
        creatorUserId: payload.creatorUserId,
      },
    })
  }

  @OnEvent("guild.member.joined")
  async handleMemberJoined(payload: any) {
    console.log("Member joined guild:", payload.guildId)

    // Log activity
    await this.guildCacheService.cacheGuildActivity(payload.guildId, {
      type: "member_joined",
      timestamp: new Date(),
      data: {
        userId: payload.member.userId,
        role: payload.member.role,
      },
    })
  }

  @OnEvent("guild.member.left")
  async handleMemberLeft(payload: any) {
    console.log("Member left guild:", payload.guildId)

    // Log activity
    await this.guildCacheService.cacheGuildActivity(payload.guildId, {
      type: "member_left",
      timestamp: new Date(),
      data: {
        userId: payload.userId,
      },
    })
  }
}
