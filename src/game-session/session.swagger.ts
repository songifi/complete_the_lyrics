import { ApiExtraModels, ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { GameSessionSwagger } from './swagger/game-session.swagger';

@ApiTags('game-session')
@ApiExtraModels(GameSessionSwagger)
export class GameSessionSwaggerSchema {
  @ApiOperation({ summary: 'Create a new game session' })
  @ApiBody({ type: GameSessionSwagger })
  @ApiResponse({ status: 201, description: 'Session created', type: GameSessionSwagger })
  createSession() {}

  @ApiOperation({ summary: 'Join a game session' })
  @ApiBody({ type: GameSessionSwagger })
  @ApiResponse({ status: 200, description: 'Player joined', type: GameSessionSwagger })
  joinSession() {}

  @ApiOperation({ summary: 'Player action in session' })
  @ApiBody({ type: GameSessionSwagger })
  @ApiResponse({ status: 200, description: 'Action recorded', type: GameSessionSwagger })
  playerAction() {}

  @ApiOperation({ summary: 'End a game session' })
  @ApiBody({ type: GameSessionSwagger })
  @ApiResponse({ status: 200, description: 'Session ended', type: GameSessionSwagger })
  endSession() {}
}
