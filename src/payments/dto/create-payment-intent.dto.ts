import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  Min,
  Max,
  Length,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePaymentIntentDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(999999.99)
  @Type(() => Number)
  amount: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsUUID()
  userId: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  paymentMethodTypes?: string[];

  @IsOptional()
  @IsBoolean()
  automaticPaymentMethods?: boolean;

  @IsOptional()
  metadata?: Record<string, string>;
}
