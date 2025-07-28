import { IsUUID, IsString, IsInt, Min, IsDecimal } from "class-validator"

export class CreateMarketListingDto {
  @IsUUID()
  itemId: string

  @IsUUID()
  sellerId: string

  @IsInt()
  @Min(1)
  quantity: number

  @IsDecimal({ decimal_digits: "0,4" })
  @Min(0)
  price: string // Price per unit

  @IsString()
  currencyCode: string
}
