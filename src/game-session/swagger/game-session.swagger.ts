import { ApiProperty } from '@nestjs/swagger';
import { GameSessionStatus } from '../entities/game-session.entity';

export class GameSessionSwagger {
  @ApiProperty({ example: 'uuid', description: 'Session ID' })
  id: string;

  @ApiProperty({ enum: GameSessionStatus, description: 'Session status' })
  status: GameSessionStatus;

  @ApiProperty({ type: [String], description: 'Player IDs' })
  playerIds: string[] = [];

  @ApiProperty({ example: 4, description: 'Max players' })
  maxPlayers: number;

  @ApiProperty({ example: '2025-07-25T12:00:00Z', description: 'Created at' })
  createdAt: Date;

  @ApiProperty({ example: '2025-07-25T12:05:00Z', description: 'Started at', required: false })
  startedAt?: Date;

  @ApiProperty({ example: '2025-07-25T12:30:00Z', description: 'Ended at', required: false })
  endedAt?: Date;

  @ApiProperty({ example: 1800, description: 'Session duration in seconds' })
  duration: number;

  @ApiProperty({ example: 1.0, description: 'Completion rate' })
  completionRate: number;

  @ApiProperty({ type: 'object', description: 'Player actions', required: false })
  playerActions?: Record<string, any>;
}
