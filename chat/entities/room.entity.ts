// src/chat/entities/room.entity.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: true })
export class Room extends Document {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  members: Types.ObjectId[];

  @Prop([{ type: Types.ObjectId, ref: 'User' }])
  moderators: Types.ObjectId[];

  @Prop({ default: false })
  isPrivate: boolean;

  @Prop({ default: true })
  isActive: boolean;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
