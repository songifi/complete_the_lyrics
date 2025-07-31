import { Injectable, type CanActivate, type ExecutionContext, ForbiddenException } from "@nestjs/common"
import type { Model } from "mongoose"
import type { ChatRoom } from "../entities/chat-room.entity"

@Injectable()
export class ChatAccessGuard implements CanActivate {
  constructor(private chatRoomModel: Model<ChatRoom>) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient()
    const data = context.switchToWs().getData()

    const userId = client.userId
    const roomId = data.roomId

    if (!userId || !roomId) {
      throw new ForbiddenException("Invalid user or room")
    }

    const room = await this.chatRoomModel.findById(roomId)
    if (!room) {
      throw new ForbiddenException("Room not found")
    }

    // Check if user is participant
    const isParticipant = room.participants.some((p) => p.userId.toString() === userId)

    if (!isParticipant && room.type !== "public") {
      throw new ForbiddenException("Access denied to this room")
    }

    return true
  }
}
