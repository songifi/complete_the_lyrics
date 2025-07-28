import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { EventEmitter2 } from "@nestjs/event-emitter"
import type { Guild } from "../entities/guild.entity"
import { type GuildMember, GuildRole, MemberStatus } from "../entities/guild-member.entity"
import type { CreateGuildDto } from "../dto/create-guild.dto"
import type { UpdateGuildDto } from "../dto/update-guild.dto"
import type { AddGuildMemberDto, UpdateGuildMemberDto } from "../dto/guild-member.dto"
import type { GuildCacheService } from "./guild-cache.service"

@Injectable()
export class GuildService {
  constructor(
    private guildRepository: Repository<Guild>,
    private guildMemberRepository: Repository<GuildMember>,
    private eventEmitter: EventEmitter2,
    private guildCacheService: GuildCacheService,
  ) {}

  async createGuild(createGuildDto: CreateGuildDto, creatorUserId: string): Promise<Guild> {
    // Check if guild name already exists
    const existingGuild = await this.guildRepository.findOne({
      where: { name: createGuildDto.name },
    })

    if (existingGuild) {
      throw new ConflictException("Guild name already exists")
    }

    // Validate parent guild if specified
    if (createGuildDto.parentGuildId) {
      const parentGuild = await this.guildRepository.findOne({
        where: { id: createGuildDto.parentGuildId },
      })

      if (!parentGuild) {
        throw new NotFoundException("Parent guild not found")
      }
    }

    // Create guild
    const guild = this.guildRepository.create({
      ...createGuildDto,
      parentGuild: createGuildDto.parentGuildId ? { id: createGuildDto.parentGuildId } : undefined,
    })

    const savedGuild = await this.guildRepository.save(guild)

    // Add creator as guild leader
    await this.addGuildMember(savedGuild.id, {
      userId: creatorUserId,
      role: GuildRole.LEADER,
      permissions: this.getDefaultPermissions(GuildRole.LEADER),
    })

    // Emit guild created event
    this.eventEmitter.emit("guild.created", {
      guild: savedGuild,
      creatorUserId,
    })

    // Cache guild data
    await this.guildCacheService.cacheGuild(savedGuild)

    return savedGuild
  }

  async findGuildById(id: string): Promise<Guild> {
    // Try cache first
    let guild = await this.guildCacheService.getGuild(id)

    if (!guild) {
      guild = await this.guildRepository.findOne({
        where: { id },
        relations: ["members", "parentGuild", "subGuilds"],
      })

      if (!guild) {
        throw new NotFoundException("Guild not found")
      }

      // Cache the guild
      await this.guildCacheService.cacheGuild(guild)
    }

    return guild
  }

  async updateGuild(id: string, updateGuildDto: UpdateGuildDto): Promise<Guild> {
    const guild = await this.findGuildById(id)

    Object.assign(guild, updateGuildDto)
    const updatedGuild = await this.guildRepository.save(guild)

    // Update cache
    await this.guildCacheService.cacheGuild(updatedGuild)

    // Emit guild updated event
    this.eventEmitter.emit("guild.updated", {
      guild: updatedGuild,
    })

    return updatedGuild
  }

  async deleteGuild(id: string): Promise<void> {
    const guild = await this.findGuildById(id)

    // Check if guild has sub-guilds
    const subGuilds = await this.guildRepository.find({
      where: { parentGuild: { id } },
    })

    if (subGuilds.length > 0) {
      throw new BadRequestException("Cannot delete guild with sub-guilds")
    }

    await this.guildRepository.remove(guild)

    // Remove from cache
    await this.guildCacheService.removeGuild(id)

    // Emit guild deleted event
    this.eventEmitter.emit("guild.deleted", {
      guildId: id,
    })
  }

  async addGuildMember(guildId: string, addMemberDto: AddGuildMemberDto): Promise<GuildMember> {
    const guild = await this.findGuildById(guildId)

    // Check if guild is at capacity
    if (guild.isAtCapacity) {
      throw new BadRequestException("Guild is at maximum capacity")
    }

    // Check if user is already a member
    const existingMember = await this.guildMemberRepository.findOne({
      where: { guildId, userId: addMemberDto.userId },
    })

    if (existingMember) {
      throw new ConflictException("User is already a guild member")
    }

    const guildMember = this.guildMemberRepository.create({
      guildId,
      userId: addMemberDto.userId,
      role: addMemberDto.role || GuildRole.RECRUIT,
      permissions: addMemberDto.permissions || this.getDefaultPermissions(addMemberDto.role || GuildRole.RECRUIT),
      lastActiveAt: new Date(),
    })

    const savedMember = await this.guildMemberRepository.save(guildMember)

    // Update guild cache
    await this.guildCacheService.invalidateGuild(guildId)

    // Emit member joined event
    this.eventEmitter.emit("guild.member.joined", {
      guildId,
      member: savedMember,
    })

    return savedMember
  }

  async getGuildMember(guildId: string, userId: string): Promise<GuildMember | null> {
    return this.guildMemberRepository.findOne({
      where: { guildId, userId, status: MemberStatus.ACTIVE },
      relations: ["guild"],
    })
  }

  async updateGuildMember(
    guildId: string,
    userId: string,
    updateMemberDto: UpdateGuildMemberDto,
  ): Promise<GuildMember> {
    const guildMember = await this.getGuildMember(guildId, userId)

    if (!guildMember) {
      throw new NotFoundException("Guild member not found")
    }

    Object.assign(guildMember, updateMemberDto)
    const updatedMember = await this.guildMemberRepository.save(guildMember)

    // Update cache
    await this.guildCacheService.invalidateGuild(guildId)

    // Emit member updated event
    this.eventEmitter.emit("guild.member.updated", {
      guildId,
      member: updatedMember,
    })

    return updatedMember
  }

  async removeGuildMember(guildId: string, userId: string): Promise<void> {
    const guildMember = await this.getGuildMember(guildId, userId)

    if (!guildMember) {
      throw new NotFoundException("Guild member not found")
    }

    // Don't allow removing the last leader
    if (guildMember.role === GuildRole.LEADER) {
      const leaderCount = await this.guildMemberRepository.count({
        where: { guildId, role: GuildRole.LEADER, status: MemberStatus.ACTIVE },
      })

      if (leaderCount <= 1) {
        throw new BadRequestException("Cannot remove the last guild leader")
      }
    }

    await this.guildMemberRepository.remove(guildMember)

    // Update cache
    await this.guildCacheService.invalidateGuild(guildId)

    // Emit member left event
    this.eventEmitter.emit("guild.member.left", {
      guildId,
      userId,
    })
  }

  async getGuildHierarchy(guildId: string): Promise<Guild[]> {
    const guild = await this.findGuildById(guildId)
    const hierarchy: Guild[] = [guild]

    // Get parent guilds
    let currentGuild = guild
    while (currentGuild.parentGuild) {
      currentGuild = await this.findGuildById(currentGuild.parentGuild.id)
      hierarchy.unshift(currentGuild)
    }

    return hierarchy
  }

  async getGuildMembers(guildId: string): Promise<GuildMember[]> {
    return this.guildMemberRepository.find({
      where: { guildId, status: MemberStatus.ACTIVE },
      order: { role: "ASC", joinedAt: "ASC" },
    })
  }

  private getDefaultPermissions(role: GuildRole): Record<string, boolean> {
    const permissions: Record<string, boolean> = {}

    switch (role) {
      case GuildRole.LEADER:
        permissions["manage_guild"] = true
        permissions["manage_members"] = true
        permissions["manage_competitions"] = true
        permissions["manage_chat"] = true
        permissions["view_analytics"] = true
        break
      case GuildRole.OFFICER:
        permissions["manage_members"] = true
        permissions["manage_competitions"] = true
        permissions["manage_chat"] = true
        break
      case GuildRole.VETERAN:
        permissions["create_competitions"] = true
        permissions["moderate_chat"] = true
        break
      case GuildRole.MEMBER:
        permissions["participate_competitions"] = true
        permissions["use_chat"] = true
        break
      case GuildRole.RECRUIT:
        permissions["use_chat"] = true
        break
    }

    return permissions
  }
}
