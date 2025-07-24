// src/chat/entities/thread.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Thread extends Document {
  @Prop({ type: Types.ObjectId, ref: 'ChatMessage', required: true })
  rootMessage: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'ChatMessage' }])
  messages: Types.ObjectId[];

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId; // Changed to Types.ObjectId

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  title?: string;
}

export const ThreadSchema = SchemaFactory.createForClass(Thread);
