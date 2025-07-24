import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, Index, CreateDateColumn } from 'typeorm';
import { Player } from './player.entity';

@Entity('player_stats')
@Index(['playerId', 'recordedAt'])
@Index(['category', 'recordedAt'])
export class PlayerStats {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  playerId: string;

  @ManyToOne(() => Player, player => player.stats)
  player: Player;

  @Column()
  category: string; // 'combat', 'exploration', 'social', 'achievement'

  @Column('jsonb')
  metrics: {
    kills?: number;
    deaths?: number;
    score?: number;
    experience?: number;
    level?: number;
    wins?: number;
    losses?: number;
    accuracy?: number;
    damageDealt?: number;
    damageReceived?: number;
    itemsCollected?: number;
    questsCompleted?: number;
    socialInteractions?: number;
    timePlayedMinutes?: number;
    [key: string]: any;
  };

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  calculatedScore: number;

  @Column('jsonb', { nullable: true })
  metadata: {
    gameMode?: string;
    sessionId?: string;
    location?: string;
    difficulty?: string;
    [key: string]: any;
  };

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
