import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from "typeorm";
import { MessageType } from "../dto/chat-message.dto";
import { GameSession } from "./game-session.entity";
import { Player } from "./player.entity";

@Entity("chat_messages")
export class ChatMessage {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column("text")
  content: string;

  @Column({
    type: "enum",
    enum: MessageType,
    default: MessageType.CHAT,
  })
  type: MessageType;

  @Column({ nullable: true })
  targetPlayerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => GameSession, (session) => session.chatMessages)
  session: GameSession;

  @ManyToOne(() => Player)
  sender: Player;
}
