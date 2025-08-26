import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';

export class UserResponseDto {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  email: string;

  @ApiProperty()
  @Expose()
  username: string;

  @ApiPropertyOptional()
  @Expose()
  firstName?: string;

  @ApiPropertyOptional()
  @Expose()
  lastName?: string;

  @ApiProperty()
  @Expose()
  isEmailVerified: boolean;

  @ApiProperty()
  @Expose()
  isActive: boolean;

  @ApiProperty()
  @Expose()
  isLocked: boolean;

  @ApiPropertyOptional()
  @Expose()
  lastLoginAt?: Date;

  @ApiPropertyOptional()
  @Expose()
  preferences?: Record<string, any>;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;

  @Exclude()
  password: string;

  @Exclude()
  emailVerificationToken?: string;

  @Exclude()
  passwordResetToken?: string;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }
}