import { IsString, IsOptional, IsUrl, IsDate, IsBoolean, IsEnum, IsArray } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateProfileDto {
  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsDate()
  @Type(() => Date)
  @IsOptional()
  dateOfBirth?: Date;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  language?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsEnum(['public', 'private', 'friends'])
  @IsOptional()
  profileVisibility?: 'public' | 'private' | 'friends';

  @IsBoolean()
  @IsOptional()
  showOnlineStatus?: boolean;

  @IsBoolean()
  @IsOptional()
  allowFriendRequests?: boolean;

  @IsBoolean()
  @IsOptional()
  allowMessages?: boolean;

  @IsBoolean()
  @IsOptional()
  showActivityStatus?: boolean;

  @IsOptional()
  socialLinks?: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
  };
}
