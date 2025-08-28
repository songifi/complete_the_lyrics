import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';

export class UploadAvatarDto {
  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(100)
  @Max(2048)
  @IsOptional()
  maxWidth?: number = 512;

  @IsNumber()
  @Min(100)
  @Max(2048)
  @IsOptional()
  maxHeight?: number = 512;

  @IsNumber()
  @Min(50)
  @Max(2048)
  @IsOptional()
  quality?: number = 85;
}
