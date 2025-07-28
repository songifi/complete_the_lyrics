import type { GameMode } from "@prisma/client"
import { AbstractGameModeStrategy } from "./abstract-game-mode.strategy"
import { CaptureTheFlagRulesSchema, type CaptureTheFlagRules } from "../dto/game-mode-rules.dto"
import type { PlayerScoreUpdate } from "../interfaces/game-mode-strategy.interface"

export class CaptureTheFlagStrategy extends AbstractGameModeStrategy {
  protected parsedRules: CaptureTheFlagRules

  constructor(gameMode: GameMode) {
    super(gameMode, CaptureTheFlagRulesSchema)
    this.parsedRules = CaptureTheFlagRulesSchema.parse(gameMode.rules)
  }

  calculateScore(event: any): PlayerScoreUpdate | null {
    if (event.type === "flag_capture" && event.capturingPlayerId) {
      const scoreChange = this.parsedRules.flagCaptureScore
      console.log(`CTF: Player ${event.capturingPlayerId} captured the flag for ${scoreChange} points.`)
      return {
        userId: event.capturingPlayerId,
        scoreChange: scoreChange,
        reason: "flag_capture",
        metadata: { teamId: event.teamId },
      }
    }
    if (event.type === "flag_return" && event.returningPlayerId) {
      const scoreChange = this.parsedRules.flagReturnScore
      console.log(`CTF: Player ${event.returningPlayerId} returned the flag for ${scoreChange} points.`)
      return {
        userId: event.returningPlayerId,
        scoreChange: scoreChange,
        reason: "flag_return",
        metadata: { teamId: event.teamId },
      }
    }
    if (event.type === "flag_drop" && event.droppingPlayerId) {
      const scoreChange = this.parsedRules.flagDropPenalty
      console.log(`CTF: Player ${event.droppingPlayerId} dropped the flag, incurring ${scoreChange} penalty.`)
      return {
        userId: event.droppingPlayerId,
        scoreChange: scoreChange,
        reason: "flag_drop",
        metadata: { teamId: event.teamId },
      }
    }
    return null
  }

  // CTF specific logic
  checkMaxCaptures(currentCaptures: number): boolean {
    return currentCaptures >= this.parsedRules.maxCaptures
  }
}
