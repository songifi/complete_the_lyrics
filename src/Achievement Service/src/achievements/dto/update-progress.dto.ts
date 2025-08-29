import { IsString, IsOptional, IsNumber, IsPositive } from 'class-validator';

export class UpdateProgressDto {
  @IsString()
  action: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  value?: number;
}