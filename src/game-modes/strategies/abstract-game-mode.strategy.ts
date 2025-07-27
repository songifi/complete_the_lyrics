import { BadRequestException } from "@nestjs/common"
import type { GameMode } from "@prisma/client"
import type { z } from "zod"
import type { IGameModeStrategy, PlayerScoreUpdate } from "../interfaces/game-mode-strategy.interface"
import type { BaseGameModeRulesSchema } from "../dto/game-mode-rules.dto"

export abstract class AbstractGameModeStrategy implements IGameModeStrategy {
  protected parsedRules: z.infer<typeof BaseGameModeRulesSchema>

  constructor(
    public gameMode: GameMode,
    public rulesSchema: z.ZodObject<any>,
  ) {
    this.validateRules(gameMode.rules)
    this.parsedRules = this.rulesSchema.parse(gameMode.rules)
  }

  validateRules(rules: any): void {
    const result = this.rulesSchema.safeParse(rules)
    if (!result.success) {
      throw new BadRequestException(
        `Invalid rules for ${this.gameMode.type} mode: ${result.error.errors.map((e) => e.message).join(", ")}`,
      )
    }
  }

  applyInitialRules(): void {
    console.log(`Applying initial rules for ${this.gameMode.name} (${this.gameMode.type})`)
    console.log("Time Limit:", this.parsedRules.timeLimitSeconds || "N/A")
    console.log("Max Rounds:", this.parsedRules.maxRounds || "N/A")
    console.log("Score To Win:", this.parsedRules.scoreToWin || "N/A")
    console.log("Power-ups Enabled:", this.parsedRules.powerUpsEnabled || false)
    console.log("Modifiers:", this.parsedRules.modifiers || {})
  }

  abstract calculateScore(event: any): PlayerScoreUpdate | null

  handlePowerUp(userId: string, powerUpType: string, metadata?: Record<string, any>): void {
    console.log(`Player ${userId} activated power-up ${powerUpType} in ${this.gameMode.name} mode.`, metadata)
    // Default implementation: can be overridden by specific strategies
  }

  checkGameEndCondition(currentScores: Record<string, number>, currentTimeSeconds: number): boolean {
    if (this.parsedRules.timeLimitSeconds && currentTimeSeconds >= this.parsedRules.timeLimitSeconds) {
      console.log(`Game ended due to time limit (${this.parsedRules.timeLimitSeconds}s) for ${this.gameMode.name}.`)
      return true
    }
    if (this.parsedRules.scoreToWin) {
      const maxScore = Math.max(...Object.values(currentScores))
      if (maxScore >= this.parsedRules.scoreToWin) {
        console.log(`Game ended due to score limit (${this.parsedRules.scoreToWin}) for ${this.gameMode.name}.`)
        return true
      }
    }
    return false
  }

  getInitialGameState(): Record<string, any> {
    return {
      modeType: this.gameMode.type,
      rules: this.parsedRules,
      players: {}, // Placeholder for player-specific state
      round: 1,
      elapsedTime: 0,
    }
  }
}
