import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Max, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class CreateSongDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  artist: string;

  @IsString()
  @IsOptional()
  album?: string;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsInt()
  @IsOptional()
  releaseYear?: number;

  @IsInt()
  @IsOptional()
  durationSeconds?: number;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsString()
  @IsOptional()
  lyrics?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateSongDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  artist?: string;

  @IsString()
  @IsOptional()
  album?: string;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsInt()
  @IsOptional()
  releaseYear?: number;

  @IsInt()
  @IsOptional()
  durationSeconds?: number;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsString()
  @IsOptional()
  coverImageUrl?: string;

  @IsString()
  @IsOptional()
  lyrics?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

export class QuerySongsDto {
  @IsString()
  @IsOptional()
  q?: string;

  @IsString()
  @IsOptional()
  artist?: string;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}

export class BulkSongItemDto extends CreateSongDto {}

export class BulkImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkSongItemDto)
  items: BulkSongItemDto[];

  @IsBoolean()
  @IsOptional()
  upsert?: boolean = true;
}


