import { Controller, Get, Post, Put, Delete, Body, Query, UseGuards, Request, UsePipes } from "@nestjs/common"
import type { ChatService } from "../services/chat.service"
import type { CreateMessageDto, UpdateMessageDto } from "../dto/create-message.dto"
import type { CreateRoomDto } from "../dto/create-room.dto"
import { JwtAuthGuard } from "../../../common/guards/jwt-auth.guard"
import { ProfanityFilterPipe } from "../pipes/profanity-filter.pipe"
import { MessageFormattingPipe } from "../pipes/message-formatting.pipe"

@Controller("chat")
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("rooms/:roomId/messages")
  async getMessages(roomId: string, @Query('page') page: number = 1, @Query('limit') limit: number = 50) {
    return this.chatService.getMessages(roomId, page, limit)
  }

  @Post("messages")
  @UsePipes(ProfanityFilterPipe, MessageFormattingPipe)
  async createMessage(@Body() createMessageDto: CreateMessageDto, @Request() req) {
    return this.chatService.createMessage(createMessageDto, req.user.id)
  }

  @Put("messages/:id")
  @UsePipes(ProfanityFilterPipe, MessageFormattingPipe)
  async updateMessage(id: string, @Body() updateMessageDto: UpdateMessageDto, @Request() req) {
    return this.chatService.updateMessage(id, updateMessageDto, req.user.id)
  }

  @Delete("messages/:id")
  async deleteMessage(id: string, @Request() req) {
    return this.chatService.deleteMessage(id, req.user.id)
  }

  @Post("rooms")
  async createRoom(@Body() createRoomDto: CreateRoomDto, @Request() req) {
    return this.chatService.createRoom(createRoomDto, req.user.id)
  }

  @Get("search")
  async searchMessages(@Query('q') query: string, @Query('roomId') roomId?: string) {
    return this.chatService.searchMessages(query, roomId)
  }
}
