// src/chat/entities/chat-message.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../auth/interfaces/user.interface';

export type ChatMessageDocument = ChatMessage & Document;

@Schema({ timestamps: true })
export class ChatMessage {
  @Prop({ required: true })
  content: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  sender: User;

  @Prop({ type: Types.ObjectId, ref: 'Thread' })
  threadId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Room' })
  roomId?: Types.ObjectId;

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  recipients: Types.ObjectId[];

  @Prop([{
    emoji: { type: String, required: true },
    users: [{ type: Types.ObjectId, ref: 'User' }]
  }])
  reactions: { emoji: string; users: Types.ObjectId[] }[];

  @Prop()
  richText?: any;

  @Prop()
  filteredContent?: string;

  @Prop({ default: false })
  isFlagged: boolean;

  @Prop()
  encryptedContent?: string;

  @Prop()
  encryptionIv?: string;
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage);