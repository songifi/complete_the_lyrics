import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from "typeorm";
import { PlayerRole, PlayerMetadata } from "../interfaces/player.interface";
import { GameSession } from "./game-session.entity";

@Entity("players")
export class Player {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  username: string;

  @Column({ nullable: true })
  socketId: string;

  @Column("boolean", { default: false })
  isOnline: boolean;

  @Column({ type: "timestamp", default: () => "CURRENT_TIMESTAMP" })
  lastSeen: Date;

  @Column({
    type: "enum",
    enum: PlayerRole,
    default: PlayerRole.PLAYER,
  })
  role: PlayerRole;

  @Column("json")
  metadata: PlayerMetadata;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => GameSession, (session) => session.players)
  session: GameSession;
}
