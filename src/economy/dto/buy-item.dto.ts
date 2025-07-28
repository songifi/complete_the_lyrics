import { IsUUID, IsInt, Min } from "class-validator"

export class BuyItemDto {
  @IsUUID()
  listingId: string

  @IsInt()
  @Min(1)
  quantity: number
}
