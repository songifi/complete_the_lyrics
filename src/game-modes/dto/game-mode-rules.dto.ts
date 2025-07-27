import { z } from "zod"

// Base schema for common rules
const BaseGameModeRulesSchema = z.object({
  timeLimitSeconds: z.number().int().min(60).default(300).optional(),
  maxRounds: z.number().int().min(1).default(3).optional(),
  scoreToWin: z.number().int().min(1).default(100).optional(),
  powerUpsEnabled: z.boolean().default(false).optional(),
  modifiers: z.record(z.string(), z.any()).default({}).optional(), // Flexible modifiers
})

// Specific rules for Deathmatch
export const DeathmatchRulesSchema = BaseGameModeRulesSchema.extend({
  killScore: z.number().int().min(1).default(10),
  deathPenalty: z.number().int().max(0).default(0),
  assistScore: z.number().int().min(0).default(3),
  respawnTimeSeconds: z.number().int().min(1).default(5),
})
export type DeathmatchRules = z.infer<typeof DeathmatchRulesSchema>

// Specific rules for Capture The Flag
export const CaptureTheFlagRulesSchema = BaseGameModeRulesSchema.extend({
  flagCaptureScore: z.number().int().min(1).default(50),
  flagReturnScore: z.number().int().min(1).default(10),
  flagDropPenalty: z.number().int().max(0).default(0),
  maxCaptures: z.number().int().min(1).default(5),
})
export type CaptureTheFlagRules = z.infer<typeof CaptureTheFlagRulesSchema>

// Specific rules for Team Battle
export const TeamBattleRulesSchema = BaseGameModeRulesSchema.extend({
  teamSize: z.number().int().min(2).default(5),
  friendlyFire: z.boolean().default(false),
  teamKillPenalty: z.number().int().max(0).default(-10),
})
export type TeamBattleRules = z.infer<typeof TeamBattleRulesSchema>

// Specific rules for Speed Round
export const SpeedRoundRulesSchema = BaseGameModeRulesSchema.extend({
  timeLimitSeconds: z.number().int().min(30).max(180).default(60), // Shorter time limit
  bonusScorePerSecondRemaining: z.number().int().min(0).default(1),
})
export type SpeedRoundRules = z.infer<typeof SpeedRoundRulesSchema>

// Union type for all possible game mode rules, discriminated by a 'type' field if needed
// For this example, we'll assume the `GameModeType` enum in the entity determines which schema to use.
// If you wanted to validate the `rules` JSON itself to contain a `type` field, you'd use z.discriminatedUnion.
// For now, the validation will happen in the service based on the GameMode.type.
export type GameModeRules =
  | DeathmatchRules
  | CaptureTheFlagRules
  | TeamBattleRules
  | SpeedRoundRules
  | Record<string, any> // Fallback for CUSTOM or unknown types
