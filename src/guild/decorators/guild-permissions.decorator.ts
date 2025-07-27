import { SetMetadata } from "@nestjs/common"

export const GUILD_PERMISSIONS_KEY = "guild_permissions"

export const RequireGuildPermissions = (...permissions: string[]) => SetMetadata(GUILD_PERMISSIONS_KEY, permissions)

export const RequireGuildRole = (role: string) => SetMetadata("guild_role", role)

export const RequireGuildMembership = () => SetMetadata("guild_membership", true)
