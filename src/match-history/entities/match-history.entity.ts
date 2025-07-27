import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm"

export enum GameMode {
  DEATHMATCH = "deathmatch",
  TEAM_DEATHMATCH = "team_deathmatch",
  CAPTURE_THE_FLAG = "capture_the_flag",
  BATTLE_ROYALE = "battle_royale",
  CUSTOM = "custom",
}

export interface PlayerResult {
  userId: string
  teamId?: string
  score: number
  kills: number
  deaths: number
  assists: number
  damageDealt: number
  damageTaken: number
  healingDone: number
  objectiveScore: number
  performanceMetrics: Record<string, any> // Flexible for game-specific metrics
  equipment?: Record<string, any>
  abilitiesUsed?: Record<string, number>
}

export interface MatchEvent {
  timestamp: number // Milliseconds from match start
  eventType: string // e.g., "kill", "ability_use", "movement", "chat_message"
  userId?: string // User who performed the action
  targetUserId?: string // Target of the action (e.g., killed player)
  data: Record<string, any> // Event-specific data (e.g., weapon used, ability name, message content)
}

@Entity("match_history")
@Index(["gameMode", "startTime"])
@Index(["winningTeamId"])
@Index(["duration"])
export class MatchHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string

  @Column({ type: "enum", enum: GameMode })
  gameMode: GameMode

  @Column({ length: 255 })
  mapName: string

  @Column({ type: "timestamp" })
  startTime: Date

  @Column({ type: "timestamp" })
  endTime: Date

  @Column({ type: "int" }) // Duration in seconds
  duration: number

  @Column({ nullable: true })
  winningTeamId: string

  @Column({ type: "jsonb", default: [] })
  playerResults: PlayerResult[]

  @Column({ type: "jsonb", default: [] })
  replayData: MatchEvent[] // Time-series data for match events

  @Column({ type: "jsonb", default: {} })
  metadata: Record<string, any> // Flexible for additional match-specific data

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date

  // Helper to get all unique user IDs involved in the match
  get participantUserIds(): string[] {
    return Array.from(new Set(this.playerResults.map((pr) => pr.userId)))
  }
}
