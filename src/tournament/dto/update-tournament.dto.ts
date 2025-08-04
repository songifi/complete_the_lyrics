import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { CreateTournamentDto } from './create-tournament.dto';
import { TournamentStatus } from '../enums/tournament.enums';

export class UpdateTournamentDto extends PartialType(CreateTournamentDto) {
  @ApiPropertyOptional({
    description: 'Tournament status',
    enum: TournamentStatus,
  })
  @IsOptional()
  @IsEnum(TournamentStatus)
  status?: TournamentStatus;

  @ApiPropertyOptional({ description: 'Tournament end date and time' })
  @IsOptional()
  @IsDateString()
  endAt?: string;
}
