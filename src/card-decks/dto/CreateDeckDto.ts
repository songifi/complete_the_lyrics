import { IsString, IsArray, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDeckDto {
  @IsString()
  name: string;

  @IsString()
  difficulty: string;

  @IsArray()
  @Type(() => String)
  categories: string[];

  @IsOptional()
  @IsString()
  theme?: string;

  @IsOptional()
  metadata?: any;
}
