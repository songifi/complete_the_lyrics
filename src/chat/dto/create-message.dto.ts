import { IsString, IsNotEmpty, IsOptional, IsEnum, IsMongoId } from "class-validator"

export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string

  @IsMongoId()
  roomId: string

  @IsEnum(["text", "image", "file", "system"])
  @IsOptional()
  type?: string = "text"

  @IsMongoId()
  @IsOptional()
  parentMessageId?: string
}

export class UpdateMessageDto {
  @IsString()
  @IsNotEmpty()
  content: string
}

export class AddReactionDto {
  @IsString()
  @IsNotEmpty()
  emoji: string
}
