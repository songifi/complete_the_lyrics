import { IsString, IsUUID, IsOptional, IsDecimal, Min } from "class-validator"

export class CreateVirtualCurrencyDto {
  @IsUUID()
  userId: string

  @IsString()
  currencyCode: string

  @IsOptional()
  @IsDecimal({ decimal_digits: "0,4" })
  @Min(0)
  balance?: string = "0.0000"
}
