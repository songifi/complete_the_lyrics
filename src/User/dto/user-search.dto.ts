import { IsOptional, IsString, IsBoolean, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export enum UserSortField {
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  USERNAME = 'username',
  EMAIL = 'email',
  LAST_LOGIN = 'lastLoginAt',
}

export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

export class UserSearchDto {
  @ApiPropertyOptional({ description: 'Search by username or email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by email verification status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isEmailVerified?: boolean;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filter by locked status' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  isLocked?: boolean;

  @ApiPropertyOptional({ enum: UserSortField, default: UserSortField.CREATED_AT })
  @IsOptional()
  @IsEnum(UserSortField)
  sortBy?: UserSortField = UserSortField.CREATED_AT;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}