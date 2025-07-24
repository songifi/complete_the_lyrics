import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatMessage, ChatMessageSchema } from './entities/chat-message.entity';
import { Room, RoomSchema } from './entities/room.entity';
import { ChatService } from './services/chat.service';
import { DatabaseModule } from '../database/database.module';
import { MessageController } from './controllers/message.controller';

@Module({
  imports: [
    DatabaseModule,
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: Room.name, schema: RoomSchema },
    ]),
  ],
  controllers: [MessageController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
