import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus } from "@nestjs/common"
import type { VirtualCurrencyService } from "../services/virtual-currency.service"
import type { CreateVirtualCurrencyDto } from "../dto/create-currency.dto"
import type { TransactionQueryDto } from "../dto/transaction-query.dto"
import { IsUUID, IsString, IsDecimal, Min, IsOptional, IsObject } from "class-validator"

class DepositWithdrawTransferDto {
  @IsUUID()
  userId: string

  @IsString()
  currencyCode: string

  @IsDecimal({ decimal_digits: "0,4" })
  @Min(0)
  amount: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>
}

class TransferDto extends DepositWithdrawTransferDto {
  @IsUUID()
  fromUserId: string

  @IsUUID()
  toUserId: string
}

@Controller("economy/currency")
export class VirtualCurrencyController {
  constructor(private readonly virtualCurrencyService: VirtualCurrencyService) {}

  @Post("account")
  @HttpCode(HttpStatus.CREATED)
  createAccount(@Body() createCurrencyDto: CreateVirtualCurrencyDto) {
    return this.virtualCurrencyService.createCurrencyAccount(createCurrencyDto)
  }

  @Get("account/:userId/:currencyCode")
  getBalance(@Param("userId") userId: string, @Param("currencyCode") currencyCode: string) {
    return this.virtualCurrencyService.getAccountBalance(userId, currencyCode)
  }

  @Post("deposit")
  deposit(@Body() dto: DepositWithdrawTransferDto) {
    return this.virtualCurrencyService.deposit(dto.userId, dto.currencyCode, dto.amount, dto.description, dto.metadata)
  }

  @Post("withdraw")
  withdraw(@Body() dto: DepositWithdrawTransferDto) {
    return this.virtualCurrencyService.withdraw(dto.userId, dto.currencyCode, dto.amount, dto.description, dto.metadata)
  }

  @Post("transfer")
  transfer(@Body() dto: TransferDto) {
    return this.virtualCurrencyService.transfer(
      dto.fromUserId,
      dto.toUserId,
      dto.currencyCode,
      dto.amount,
      dto.description,
      dto.metadata,
    )
  }

  @Get("transactions")
  getTransactionHistory(@Query() query: TransactionQueryDto) {
    return this.virtualCurrencyService.getTransactionHistory(query)
  }

  @Get("overview")
  getEconomicOverview() {
    return this.virtualCurrencyService.getEconomicOverview()
  }
}
