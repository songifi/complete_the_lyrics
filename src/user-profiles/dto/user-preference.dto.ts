import { IsString, IsOptional, IsEnum } from 'class-validator';

export class CreatePreferenceDto {
  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsEnum(['string', 'number', 'boolean', 'json'])
  @IsOptional()
  type?: 'string' | 'number' | 'boolean' | 'json' = 'string';

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdatePreferenceDto {
  @IsString()
  value: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class BulkUpdatePreferencesDto {
  @IsOptional()
  preferences: {
    key: string;
    value: string;
    type?: 'string' | 'number' | 'boolean' | 'json';
  }[];
}
