import { Injectable } from "@nestjs/common"
import type { Cache } from "cache-manager"
import type { Guild } from "../entities/guild.entity"

@Injectable()
export class GuildCacheService {
  private readonly GUILD_CACHE_PREFIX = "guild:"
  private readonly GUILD_MEMBERS_CACHE_PREFIX = "guild:members:"
  private readonly CACHE_TTL = 3600 // 1 hour

  constructor(private cacheManager: Cache) {}

  async cacheGuild(guild: Guild): Promise<void> {
    const key = `${this.GUILD_CACHE_PREFIX}${guild.id}`
    await this.cacheManager.set(key, guild, this.CACHE_TTL)
  }

  async getGuild(guildId: string): Promise<Guild | null> {
    const key = `${this.GUILD_CACHE_PREFIX}${guildId}`
    return this.cacheManager.get<Guild>(key)
  }

  async removeGuild(guildId: string): Promise<void> {
    const key = `${this.GUILD_CACHE_PREFIX}${guildId}`
    await this.cacheManager.del(key)
  }

  async invalidateGuild(guildId: string): Promise<void> {
    await this.removeGuild(guildId)

    // Also invalidate guild members cache
    const membersKey = `${this.GUILD_MEMBERS_CACHE_PREFIX}${guildId}`
    await this.cacheManager.del(membersKey)
  }

  async cacheGuildActivity(guildId: string, activity: any): Promise<void> {
    const key = `guild:activity:${guildId}`
    const activities = (await this.cacheManager.get<any[]>(key)) || []
    activities.unshift(activity)

    // Keep only last 100 activities
    if (activities.length > 100) {
      activities.splice(100)
    }

    await this.cacheManager.set(key, activities, this.CACHE_TTL)
  }

  async getGuildActivity(guildId: string): Promise<any[]> {
    const key = `guild:activity:${guildId}`
    return this.cacheManager.get<any[]>(key) || []
  }
}
