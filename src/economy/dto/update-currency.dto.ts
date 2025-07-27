import { PartialType } from "@nestjs/mapped-types"
import { CreateVirtualCurrencyDto } from "./create-currency.dto"

export class UpdateVirtualCurrencyDto extends PartialType(CreateVirtualCurrencyDto) {}
