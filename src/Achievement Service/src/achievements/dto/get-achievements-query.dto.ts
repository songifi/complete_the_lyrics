import { IsOptional, IsString, IsEnum, IsNumber, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetAchievementsQueryDto {
  @IsOptional()
  @IsEnum(['locked', 'in_progress', 'unlocked'])
  status?: 'locked' | 'in_progress' | 'unlocked';

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(0)
  offset?: number;
}
