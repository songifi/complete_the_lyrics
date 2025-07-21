import { IsOptional, IsString, Length } from 'class-validator';

export class JoinTeamDto {
  @IsOptional()
  @IsString()
  @Length(0, 200)
  message?: string;
}
