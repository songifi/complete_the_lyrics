import { IsString, IsOptional, IsEnum, IsBoolean, IsObject } from "class-validator"
import { GameModeType } from "@prisma/client"
import { Type } from "class-transformer"

export class CreateGameModeDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(GameModeType)
  type: GameModeType

  @IsOptional()
  @IsObject()
  @Type(() => Object) // Ensure it's treated as an object for validation
  rules?: Record<string, any> // Will be validated against specific Zod schemas in service

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
