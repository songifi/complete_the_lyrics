import { IsString, IsEnum, IsOptional, IsObject, IsInt, Min } from "class-validator"
import { GuildRole, MemberStatus } from "../entities/guild-member.entity"

export class AddGuildMemberDto {
  @IsString()
  userId: string

  @IsOptional()
  @IsEnum(GuildRole)
  role?: GuildRole

  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>
}

export class UpdateGuildMemberDto {
  @IsOptional()
  @IsEnum(GuildRole)
  role?: GuildRole

  @IsOptional()
  @IsEnum(MemberStatus)
  status?: MemberStatus

  @IsOptional()
  @IsInt()
  @Min(0)
  contributionPoints?: number

  @IsOptional()
  @IsObject()
  permissions?: Record<string, boolean>

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
