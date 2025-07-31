import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose"
import { Document, Types } from "mongoose"

@Schema({ timestamps: true })
export class ChatMessage extends Document {
  @Prop({ required: true })
  content: string

  @Prop({ required: true, type: Types.ObjectId, ref: "User" })
  senderId: Types.ObjectId

  @Prop({ required: true, type: Types.ObjectId, ref: "ChatRoom" })
  roomId: Types.ObjectId

  @Prop({ enum: ["text", "image", "file", "system"], default: "text" })
  type: string

  @Prop({
    type: [
      {
        emoji: String,
        userId: { type: Types.ObjectId, ref: "User" },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  reactions: Array<{
    emoji: string
    userId: Types.ObjectId
    createdAt: Date
  }>

  @Prop({ type: Types.ObjectId, ref: "ChatMessage", default: null })
  parentMessageId: Types.ObjectId

  @Prop({
    type: [
      {
        type: Types.ObjectId,
        ref: "ChatMessage",
      },
    ],
    default: [],
  })
  replies: Types.ObjectId[]

  @Prop({ default: false })
  isEdited: boolean

  @Prop({ default: false })
  isDeleted: boolean

  @Prop({ default: false })
  isModerated: boolean

  @Prop()
  moderationReason?: string

  @Prop()
  encryptedContent?: string

  createdAt: Date
  updatedAt: Date
}

export const ChatMessageSchema = SchemaFactory.createForClass(ChatMessage)

// Add indexes for better performance
ChatMessageSchema.index({ roomId: 1, createdAt: -1 })
ChatMessageSchema.index({ senderId: 1 })
ChatMessageSchema.index({ parentMessageId: 1 })
