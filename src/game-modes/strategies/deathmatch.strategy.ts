import type { GameMode } from "@prisma/client"
import { AbstractGameModeStrategy } from "./abstract-game-mode.strategy"
import { DeathmatchRulesSchema, type DeathmatchRules } from "../dto/game-mode-rules.dto"
import type { PlayerScoreUpdate } from "../interfaces/game-mode-strategy.interface"

export class DeathmatchStrategy extends AbstractGameModeStrategy {
  protected parsedRules: DeathmatchRules

  constructor(gameMode: GameMode) {
    super(gameMode, DeathmatchRulesSchema)
    this.parsedRules = DeathmatchRulesSchema.parse(gameMode.rules) // Re-parse with specific schema
  }

  calculateScore(event: any): PlayerScoreUpdate | null {
    if (event.type === "kill" && event.killerId && event.victimId) {
      const scoreChange = this.parsedRules.killScore
      console.log(`Deathmatch: Player ${event.killerId} scored ${scoreChange} for killing ${event.victimId}.`)
      return {
        userId: event.killerId,
        scoreChange: scoreChange,
        reason: "kill",
        metadata: { victimId: event.victimId, weapon: event.weapon },
      }
    }
    if (event.type === "assist" && event.assisterId) {
      const scoreChange = this.parsedRules.assistScore
      console.log(`Deathmatch: Player ${event.assisterId} scored ${scoreChange} for an assist.`)
      return {
        userId: event.assisterId,
        scoreChange: scoreChange,
        reason: "assist",
        metadata: { victimId: event.victimId },
      }
    }
    if (event.type === "death" && event.victimId) {
      const scoreChange = this.parsedRules.deathPenalty
      console.log(`Deathmatch: Player ${event.victimId} incurred penalty of ${scoreChange} for dying.`)
      return {
        userId: event.victimId,
        scoreChange: scoreChange,
        reason: "death",
        metadata: { killerId: event.killerId },
      }
    }
    return null
  }

  // Deathmatch specific logic can go here
  handleRespawn(userId: string): void {
    console.log(`Player ${userId} respawned after ${this.parsedRules.respawnTimeSeconds} seconds.`)
  }
}
