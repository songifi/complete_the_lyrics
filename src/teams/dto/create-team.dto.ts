import { IsString, IsNotEmpty, IsOptional, Length } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 50)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}
