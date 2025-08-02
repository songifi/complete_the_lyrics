import { IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class JoinRoomDto {
  @ApiPropertyOptional({
    description: 'Password for password-protected rooms',
    example: 'mySecretPassword',
    minLength: 6,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @Length(6, 50)
  password?: string;
}
