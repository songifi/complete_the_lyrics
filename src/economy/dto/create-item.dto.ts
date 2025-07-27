import { IsString, IsOptional, IsEnum, IsDecimal, Min, IsObject } from "class-validator"
import { ItemType } from "../entities/virtual-item.entity"

export class CreateVirtualItemDto {
  @IsString()
  name: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(ItemType)
  itemType: ItemType

  @IsOptional()
  @IsDecimal({ decimal_digits: "0,4" })
  @Min(0)
  basePrice?: string = "0.0000"

  @IsOptional()
  @IsString()
  iconUrl?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}
