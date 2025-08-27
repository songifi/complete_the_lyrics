import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { Socket } from "socket.io";
import { ConnectionRecoveryService } from "../services/connection-recovery.service";

@Injectable()
export class SessionAuthGuard implements CanActivate {
  private readonly logger = new Logger(SessionAuthGuard.name);

  constructor(private connectionRecoveryService: ConnectionRecoveryService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const connectionState = this.connectionRecoveryService.getConnectionState(
      client.id
    );

    if (!connectionState) {
      this.logger.warn(`Unauthorized socket operation: ${client.id}`);
      throw new WsException("No active session found");
    }

    // Add player ID to context for use in handlers
    context.switchToWs().getData().playerId = connectionState.playerId;

    return true;
  }
}
