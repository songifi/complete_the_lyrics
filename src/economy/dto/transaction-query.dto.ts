import { IsOptional, IsUUID, IsString, IsEnum, IsDateString, IsInt, Min } from "class-validator"
import { TransactionType } from "../entities/transaction.entity"
import { Type } from "class-transformer"

export class TransactionQueryDto {
  @IsOptional()
  @IsUUID()
  accountId?: string // Can be fromAccountId or toAccountId

  @IsOptional()
  @IsEnum(TransactionType)
  transactionType?: TransactionType

  @IsOptional()
  @IsString()
  currencyCode?: string

  @IsOptional()
  @IsDateString()
  startDate?: string

  @IsOptional()
  @IsDateString()
  endDate?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0
}
