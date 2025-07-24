// src/chat/controllers/message.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { ChatService } from '../services/chat.service';
import { CreateMessageDto } from '../dtos/create-message.dto';
import { User } from '../../common/decorators/user.decorator';
import { MessageEncryptionInterceptor } from '../interceptors/message-encryption.interceptor';
import { ProfanityFilterPipe } from '../pipes/profanity-filter.pipe';
import { SearchMessageDto } from '../dtos/search-message.dto';
import { Types } from 'mongoose';
import { JwtAuthGuard } from 'auth/guard/jwt-auth.guard';

interface AuthenticatedUser {
  userId: Types.ObjectId;
  username: string;
  // Add other user properties as needed
}

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  @UsePipes(ProfanityFilterPipe)
  async create(
    @Body() createMessageDto: CreateMessageDto,
    @User() user: AuthenticatedUser,
  ): Promise<any> {
    return this.chatService.createMessage({
      ...createMessageDto,
      sender: user.userId,
    });
  }

  @Get('room/:roomId')
  async getRoomMessages(
    @Param('roomId') roomId: string,
    @Query('limit') limit = 50,
    @Query('before') before?: string,
  ): Promise<any[]> {
    const beforeDate = before ? new Date(before) : undefined;
    return this.chatService.getMessagesByRoom(
      new Types.ObjectId(roomId),
      Number(limit),
      beforeDate,
    );
  }

  @Get('private/:userId')
  @UseInterceptors(MessageEncryptionInterceptor)
  async getPrivateMessages(
    @Param('userId') recipientId: string,
    @User() user: AuthenticatedUser,
    @Query('limit') limit = 50,
    @Query('before') before?: string,
  ): Promise<any[]> {
    const beforeDate = before ? new Date(before) : undefined;
    return this.chatService.getPrivateMessages(
      user.userId,
      new Types.ObjectId(recipientId),
      Number(limit),
      beforeDate,
    );
  }

  @Get('search')
  async searchMessages(
    @Query() searchDto: SearchMessageDto,
    @User() user: AuthenticatedUser,
  ): Promise<any[]> {
    return this.chatService.searchMessages(searchDto.query, {
      roomId: searchDto.roomId
        ? new Types.ObjectId(searchDto.roomId)
        : undefined,
      userId: searchDto.userId
        ? new Types.ObjectId(searchDto.userId)
        : undefined,
      isPrivate: searchDto.isPrivate,
      fromDate: searchDto.fromDate,
      toDate: searchDto.toDate,
    });
  }

  @Post(':id/reactions')
  async addReaction(
    @Param('id') messageId: string,
    @Body('emoji') emoji: string,
    @User() user: AuthenticatedUser,
  ): Promise<any> {
    return this.chatService.addReaction(
      new Types.ObjectId(messageId),
      emoji,
      user.userId,
    );
  }

  @Get('flagged')
  async getFlaggedMessages(): Promise<any[]> {
    return this.chatService.getFlaggedMessages();
  }
}
