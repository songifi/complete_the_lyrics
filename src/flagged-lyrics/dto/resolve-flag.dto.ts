import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FlagStatus } from '../entities/flagged-lyrics.entity';

export class ResolveFlagDto {
  @IsEnum(FlagStatus)
  status: FlagStatus.RESOLVED | FlagStatus.REJECTED;

  @IsOptional()
  @IsString()
  resolutionNotes?: string;
}
