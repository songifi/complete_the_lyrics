import { createParamDecorator, type ExecutionContext } from "@nestjs/common"
import type { GuildMember } from "../entities/guild-member.entity"

export const CurrentGuildMember = createParamDecorator((data: unknown, ctx: ExecutionContext): GuildMember => {
  const request = ctx.switchToHttp().getRequest()
  return request.guildMember
})
