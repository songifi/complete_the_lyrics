import type { GameMode } from "@prisma/client"
import type { z } from "zod"
import type {
  DeathmatchRulesSchema,
  CaptureTheFlagRulesSchema,
  TeamBattleRulesSchema,
  SpeedRoundRulesSchema,
} from "../dto/game-mode-rules.dto"

export type PlayerScoreUpdate = {
  userId: string
  scoreChange: number
  reason: string
  metadata?: Record<string, any>
}

export interface IGameModeStrategy {
  gameMode: GameMode
  rulesSchema:
    | typeof DeathmatchRulesSchema
    | typeof CaptureTheFlagRulesSchema
    | typeof TeamBattleRulesSchema
    | typeof SpeedRoundRulesSchema
    | z.ZodObject<any>

  // Validates the rules JSON against the specific schema for this mode
  validateRules(rules: any): void

  // Applies initial rules or setup for a game instance
  applyInitialRules(): void

  // Calculates score for a player based on an event
  calculateScore(event: any): PlayerScoreUpdate | null

  // Handles power-up activation
  handlePowerUp(userId: string, powerUpType: string, metadata?: Record<string, any>): void

  // Checks if a game condition is met (e.g., time limit, score limit)
  checkGameEndCondition(currentScores: Record<string, number>, currentTimeSeconds: number): boolean

  // Gets initial game state for this mode
  getInitialGameState(): Record<string, any>

  // Any other mode-specific logic
  [key: string]: any
}
