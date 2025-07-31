import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Document, Types } from "mongoose"

@Schema({ timestamps: true })
export class ChatRoom extends Document {
  @Prop({ required: true })
  name: string

  @Prop({ enum: ["public", "private", "direct"], default: "public" })
  type: string

  @Prop({
    type: [
      {
        userId: { type: Types.ObjectId, ref: "User" },
        role: { type: String, enum: ["admin", "moderator", "member"], default: "member" },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
  })
  participants: Array<{
    userId: Types.ObjectId
    role: string
    joinedAt: Date
  }>

  @Prop({ type: Types.ObjectId, ref: "User" })
  createdBy: Types.ObjectId

  @Prop()
  description?: string

  @Prop({ default: true })
  isActive: boolean

  @Prop({
    maxMembers: { type: Number, default: 100 },
    allowFileSharing: { type: Boolean, default: true },
    moderationEnabled: { type: Boolean, default: true },
  })
  settings: {
    maxMembers: number
    allowFileSharing: boolean
    moderationEnabled: boolean
  }

  createdAt: Date
  updatedAt: Date
}

export const ChatRoomSchema = SchemaFactory.createForClass(ChatRoom)

ChatRoomSchema.index({ type: 1 })
ChatRoomSchema.index({ "participants.userId": 1 })
