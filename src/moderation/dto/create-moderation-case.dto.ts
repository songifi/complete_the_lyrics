import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ContentType } from '../../common/enums/content-type.enum';

export class CreateModerationCaseDto {
  @IsString()
  contentId: string;

  @IsEnum(ContentType)
  contentType: ContentType;

  @IsString()
  content: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
