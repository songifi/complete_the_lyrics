import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from "typeorm";
import {
  GameSessionStatus,
  GameSettings,
} from "../interfaces/session.interface";
import { Player } from "./player.entity";
import { ChatMessage } from "./chat-message.entity";

@Entity("game_sessions")
export class GameSession {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  name: string;

  @Column("int")
  maxPlayers: number;

  @Column("int", { default: 0 })
  currentPlayers: number;

  @Column({
    type: "enum",
    enum: GameSessionStatus,
    default: GameSessionStatus.WAITING,
  })
  status: GameSessionStatus;

  @Column("json")
  settings: GameSettings;

  @Column("json", { nullable: true })
  gameData: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Player, (player) => player.session)
  players: Player[];

  @OneToMany(() => ChatMessage, (message) => message.session)
  chatMessages: ChatMessage[];
}
