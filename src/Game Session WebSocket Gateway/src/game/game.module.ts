import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { GameSession } from "./entities/game-session.entity";
import { Player } from "./entities/player.entity";
import { ChatMessage } from "./entities/chat-message.entity";
import { GameSessionService } from "./services/game-session.service";
import { RoomManagerService } from "./services/room-manager.service";
import { PlayerPresenceService } from "./services/player-presence.service";
import { ConnectionRecoveryService } from "./services/connection-recovery.service";
import { GameSessionGateway } from "./gateways/game-session.gateway";
import { SessionAuthGuard } from "./guards/session-auth.guard";

@Module({
  imports: [TypeOrmModule.forFeature([GameSession, Player, ChatMessage])],
  providers: [
    GameSessionService,
    RoomManagerService,
    PlayerPresenceService,
    ConnectionRecoveryService,
    GameSessionGateway,
    SessionAuthGuard,
  ],
  exports: [
    GameSessionService,
    RoomManagerService,
    PlayerPresenceService,
    ConnectionRecoveryService,
  ],
})
export class GameModule {}
