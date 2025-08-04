import { IsString, IsNotEmpty, IsOptional, IsEnum, IsArray, IsNumber, IsBoolean } from "class-validator"

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  name: string

  @IsEnum(["public", "private", "direct"])
  @IsOptional()
  type?: string = "public"

  @IsString()
  @IsOptional()
  description?: string

  @IsArray()
  @IsOptional()
  participantIds?: string[]

  @IsNumber()
  @IsOptional()
  maxMembers?: number = 100

  @IsBoolean()
  @IsOptional()
  allowFileSharing?: boolean = true

  @IsBoolean()
  @IsOptional()
  moderationEnabled?: boolean = true
}
