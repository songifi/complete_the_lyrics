import { IsString, IsOptional, IsInt, Min, Max, IsEnum, IsObject } from "class-validator"
import { Transform } from "class-transformer"
import { GuildStatus } from "../entities/guild.entity"

export class CreateGuildDto {
  @IsString()
  @Transform(({ value }) => value?.trim())
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  logo?: string

  @IsOptional()
  @IsEnum(GuildStatus)
  status?: GuildStatus

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(200)
  maxMembers?: number

  @IsOptional()
  @IsString()
  parentGuildId?: string

  @IsOptional()
  @IsObject()
  settings?: Record<string, any>

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
