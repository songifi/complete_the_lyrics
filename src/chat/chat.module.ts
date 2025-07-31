import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ElasticsearchModule } from "@nestjs/elasticsearch";
import { ChatService } from "./services/chat.service";
import { RateLimiterService } from "./services/rate-limiter.service";
import { ChatGateway } from "./gateways/chat.gateway";
import { ChatController } from "./controllers/chat.controller";
import { ChatMessage, ChatMessageSchema } from "./entities/chat-message.entity";
import { ChatRoom, ChatRoomSchema } from "./entities/chat-room.entity";
import { ChatAccessGuard } from "./guards/chat-access.guard";
import { ProfanityFilterPipe } from "./pipes/profanity-filter.pipe";
import { MessageFormattingPipe } from "./pipes/message-formatting.pipe";
import { CommonModule } from "../common/common.module";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChatMessage.name, schema: ChatMessageSchema },
      { name: ChatRoom.name, schema: ChatRoomSchema },
    ]),
    ElasticsearchModule.register({
      node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
    }),
    CommonModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    RateLimiterService,
    ChatGateway,
    ChatAccessGuard,
    ProfanityFilterPipe,
    MessageFormattingPipe,
  ],
  exports: [ChatService, RateLimiterService],
})
export class ChatModule {}
