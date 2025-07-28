import { IsUUID, IsOptional, IsString } from 'class-validator';

export class ProcessPaymentDto {
  @IsUUID()
  transactionId: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  paymentMethodId?: string;
}

export class RefundPaymentDto {
  @IsUUID()
  transactionId: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  amount?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
