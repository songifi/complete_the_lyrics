import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from "@nestjs/common"
import type { GuildService } from "../services/guild.service"
import type { CreateGuildDto } from "../dto/create-guild.dto"
import type { UpdateGuildDto } from "../dto/update-guild.dto"
import type { AddGuildMemberDto, UpdateGuildMemberDto } from "../dto/guild-member.dto"
import { GuildAccessGuard } from "../guards/guild-access.guard"
import { RequireGuildPermissions, RequireGuildRole } from "../decorators/guild-permissions.decorator"
import { GuildRole } from "../entities/guild-member.entity"

@Controller("guilds")
export class GuildController {
  constructor(private readonly guildService: GuildService) {}

  @Post()
  async createGuild(@Body() createGuildDto: CreateGuildDto, @Request() req) {
    return this.guildService.createGuild(createGuildDto, req.user.id)
  }

  @Get(':guildId')
  @UseGuards(GuildAccessGuard)
  async findGuild(@Param('guildId') guildId: string) {
    return this.guildService.findGuildById(guildId);
  }

  @Patch(":guildId")
  @UseGuards(GuildAccessGuard)
  @RequireGuildPermissions("manage_guild")
  async updateGuild(@Param('guildId') guildId: string, @Body() updateGuildDto: UpdateGuildDto) {
    return this.guildService.updateGuild(guildId, updateGuildDto)
  }

  @Delete(':guildId')
  @UseGuards(GuildAccessGuard)
  @RequireGuildRole(GuildRole.LEADER)
  async deleteGuild(@Param('guildId') guildId: string) {
    await this.guildService.deleteGuild(guildId);
    return { message: 'Guild deleted successfully' };
  }

  @Get(':guildId/members')
  @UseGuards(GuildAccessGuard)
  async getGuildMembers(@Param('guildId') guildId: string) {
    return this.guildService.getGuildMembers(guildId);
  }

  @Post(":guildId/members")
  @UseGuards(GuildAccessGuard)
  @RequireGuildPermissions("manage_members")
  async addGuildMember(@Param('guildId') guildId: string, @Body() addMemberDto: AddGuildMemberDto) {
    return this.guildService.addGuildMember(guildId, addMemberDto)
  }

  @Patch(":guildId/members/:userId")
  @UseGuards(GuildAccessGuard)
  @RequireGuildPermissions("manage_members")
  async updateGuildMember(
    @Param('guildId') guildId: string,
    @Param('userId') userId: string,
    @Body() updateMemberDto: UpdateGuildMemberDto,
  ) {
    return this.guildService.updateGuildMember(guildId, userId, updateMemberDto)
  }

  @Delete(":guildId/members/:userId")
  @UseGuards(GuildAccessGuard)
  @RequireGuildPermissions("manage_members")
  async removeGuildMember(@Param('guildId') guildId: string, @Param('userId') userId: string) {
    await this.guildService.removeGuildMember(guildId, userId)
    return { message: "Member removed successfully" }
  }

  @Get(':guildId/hierarchy')
  @UseGuards(GuildAccessGuard)
  async getGuildHierarchy(@Param('guildId') guildId: string) {
    return this.guildService.getGuildHierarchy(guildId);
  }
}
