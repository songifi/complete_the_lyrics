// src/chat/chat.module.ts
import { Module } from '@nestjs/common';
import { ChatGateway } from './gateways/chat.gateway';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from './entities/chat-message.entity';
import { ChatService } from './services/chat.service';
import { MessageController } from './controllers/message.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
    ]),
  ],
  controllers: [MessageController],
  providers: [ChatGateway, ChatService],
  exports: [ChatService],
})
export class ChatModule {}
