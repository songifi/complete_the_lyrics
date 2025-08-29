import { IsString, IsEnum, IsOptional } from 'class-validator';

export class ShareAchievementDto {
  @IsEnum(['twitter', 'facebook', 'linkedin', 'other'])
  platform: 'twitter' | 'facebook' | 'linkedin' | 'other';

  @IsOptional()
  @IsString()
  message?: string;
}