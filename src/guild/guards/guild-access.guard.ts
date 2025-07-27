import {
  Injectable,
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common"
import type { Reflector } from "@nestjs/core"
import type { GuildService } from "../services/guild.service"
import { GUILD_PERMISSIONS_KEY } from "../decorators/guild-permissions.decorator"
import { GuildRole } from "../entities/guild-member.entity"

@Injectable()
export class GuildAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private guildService: GuildService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const guildId = request.params.guildId || request.body.guildId
    const userId = request.user?.id

    if (!guildId || !userId) {
      throw new ForbiddenException("Guild ID and User ID are required")
    }

    // Check if user is a member of the guild
    const guildMember = await this.guildService.getGuildMember(guildId, userId)
    if (!guildMember) {
      throw new NotFoundException("Guild member not found")
    }

    // Attach guild member to request for use in controllers
    request.guildMember = guildMember

    // Check required permissions
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(GUILD_PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    if (requiredPermissions) {
      const hasPermissions = requiredPermissions.every((permission) => this.hasPermission(guildMember, permission))

      if (!hasPermissions) {
        throw new ForbiddenException("Insufficient guild permissions")
      }
    }

    // Check required role
    const requiredRole = this.reflector.getAllAndOverride<string>("guild_role", [
      context.getHandler(),
      context.getClass(),
    ])

    if (requiredRole && !this.hasRole(guildMember, requiredRole)) {
      throw new ForbiddenException("Insufficient guild role")
    }

    return true
  }

  private hasPermission(guildMember: any, permission: string): boolean {
    // Leaders have all permissions
    if (guildMember.role === GuildRole.LEADER) {
      return true
    }

    // Check explicit permissions
    return guildMember.permissions[permission] === true
  }

  private hasRole(guildMember: any, requiredRole: string): boolean {
    const roleHierarchy = {
      [GuildRole.LEADER]: 5,
      [GuildRole.OFFICER]: 4,
      [GuildRole.VETERAN]: 3,
      [GuildRole.MEMBER]: 2,
      [GuildRole.RECRUIT]: 1,
    }

    return roleHierarchy[guildMember.role] >= roleHierarchy[requiredRole]
  }
}
