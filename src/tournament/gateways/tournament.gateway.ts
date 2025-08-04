import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Injectable,
  Logger,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import { TournamentCacheService } from '../services/tournament-cache.service';
import { TournamentService } from '../services/tournament.service';
import { WsJwtGuard } from '../guards/ws-jwt.guard';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  tournamentSubscriptions?: Set<string>;
}

interface JoinTournamentDto {
  tournamentId: string;
}

interface TournamentUpdatePayload {
  type: string;
  tournamentId: string;
  data: any;
  timestamp: Date;
}

@Injectable()
@WebSocketGateway({
  namespace: '/tournaments',
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class TournamentGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TournamentGateway.name);
  private connectedClients = new Map<string, AuthenticatedSocket>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly cacheService: TournamentCacheService,
    private readonly tournamentService: TournamentService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('Tournament WebSocket Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractTokenFromHandshake(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.userId = payload.sub;
      client.tournamentSubscriptions = new Set();

      this.connectedClients.set(client.id, client);
      this.logger.log(`Client ${client.id} connected (User: ${client.userId})`);

      client.emit('connected', {
        message: 'Connected to tournament gateway',
        userId: client.userId,
      });
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.connectedClients.delete(client.id);
    this.logger.log(`Client ${client.id} disconnected`);
  }

  @SubscribeMessage('join_tournament')
  @UseGuards(WsJwtGuard)
  @UsePipes(new ValidationPipe())
  async handleJoinTournament(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinTournamentDto,
  ) {
    try {
      const { tournamentId } = data;

      // Verify tournament exists and user has access
      const tournament =
        await this.tournamentService.getTournament(tournamentId);
      if (!tournament) {
        throw new WsException('Tournament not found');
      }

      // Check if user is participant or owner
      const hasAccess = await this.checkTournamentAccess(
        client.userId!,
        tournamentId,
      );
      if (!hasAccess) {
        throw new WsException('Access denied to tournament');
      }

      // Join tournament room
      await client.join(`tournament:${tournamentId}`);
      client.tournamentSubscriptions!.add(tournamentId);

      // Send current tournament state
      const currentState = await this.getCurrentTournamentState(tournamentId);
      client.emit('tournament_state', currentState);

      this.logger.log(`Client ${client.id} joined tournament ${tournamentId}`);

      // Notify other participants
      client.to(`tournament:${tournamentId}`).emit('participant_joined', {
        userId: client.userId,
        tournamentId,
        timestamp: new Date(),
      });

      return { success: true, tournamentId };
    } catch (error) {
      this.logger.error(`Failed to join tournament: ${error.message}`);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('leave_tournament')
  @UseGuards(WsJwtGuard)
  async handleLeaveTournament(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinTournamentDto,
  ) {
    try {
      const { tournamentId } = data;

      await client.leave(`tournament:${tournamentId}`);
      client.tournamentSubscriptions!.delete(tournamentId);

      this.logger.log(`Client ${client.id} left tournament ${tournamentId}`);

      // Notify other participants
      client.to(`tournament:${tournamentId}`).emit('participant_left', {
        userId: client.userId,
        tournamentId,
        timestamp: new Date(),
      });

      return { success: true, tournamentId };
    } catch (error) {
      this.logger.error(`Failed to leave tournament: ${error.message}`);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('get_tournament_state')
  @UseGuards(WsJwtGuard)
  async handleGetTournamentState(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinTournamentDto,
  ) {
    try {
      const { tournamentId } = data;
      const state = await this.getCurrentTournamentState(tournamentId);
      client.emit('tournament_state', state);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to get tournament state: ${error.message}`);
      throw new WsException(error.message);
    }
  }

  @SubscribeMessage('get_live_matches')
  @UseGuards(WsJwtGuard)
  async handleGetLiveMatches(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: JoinTournamentDto,
  ) {
    try {
      const { tournamentId } = data;
      const matches =
        await this.tournamentService.getActiveMatches(tournamentId);
      client.emit('live_matches', { tournamentId, matches });
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to get live matches: ${error.message}`);
      throw new WsException(error.message);
    }
  }

  // Event listeners for tournament lifecycle events
  @OnEvent('tournament.created')
  async handleTournamentCreated(data: any) {
    this.broadcastToRoom('all_tournaments', {
      type: 'tournament_created',
      tournamentId: data.id,
      data,
      timestamp: new Date(),
    });
  }

  @OnEvent('tournament.started')
  async handleTournamentStarted(data: any) {
    this.broadcastToTournament(data.id, {
      type: 'tournament_started',
      tournamentId: data.id,
      data,
      timestamp: new Date(),
    });
  }

  @OnEvent('tournament.participant.registered')
  async handleParticipantRegistered(data: any) {
    this.broadcastToTournament(data.tournament.id, {
      type: 'participant_registered',
      tournamentId: data.tournament.id,
      data: data.participant,
      timestamp: new Date(),
    });
  }

  @OnEvent('tournament.participant.eliminated')
  async handleParticipantEliminated(data: any) {
    this.broadcastToTournament(data.tournamentId, {
      type: 'participant_eliminated',
      tournamentId: data.tournamentId,
      data,
      timestamp: new Date(),
    });
  }

  @OnEvent('match.started')
  async handleMatchStarted(data: any) {
    this.broadcastToTournament(data.tournamentId, {
      type: 'match_started',
      tournamentId: data.tournamentId,
      data,
      timestamp: new Date(),
    });
  }

  @OnEvent('tournament.match.completed')
  async handleMatchCompleted(data: any) {
    this.broadcastToTournament(data.match.tournamentId, {
      type: 'match_completed',
      tournamentId: data.match.tournamentId,
      data,
      timestamp: new Date(),
    });

    // Update and broadcast new leaderboard
    setTimeout(async () => {
      await this.broadcastLeaderboardUpdate(data.match.tournamentId);
    }, 1000);
  }

  @OnEvent('match.scheduled')
  async handleMatchScheduled(data: any) {
    this.broadcastToTournament(data.tournamentId, {
      type: 'match_scheduled',
      tournamentId: data.tournamentId,
      data,
      timestamp: new Date(),
    });
  }

  @OnEvent('tournament.round_completed')
  async handleRoundCompleted(data: any) {
    this.broadcastToTournament(data.tournamentId, {
      type: 'round_completed',
      tournamentId: data.tournamentId,
      data,
      timestamp: new Date(),
    });
  }

  @OnEvent('tournament.leaderboard_updated')
  async handleLeaderboardUpdated(data: any) {
    this.broadcastToTournament(data.tournamentId, {
      type: 'leaderboard_updated',
      tournamentId: data.tournamentId,
      data: data.leaderboard,
      timestamp: new Date(),
    });
  }

  @OnEvent('tournament.prize.distributed')
  async handlePrizeDistributed(data: any) {
    this.broadcastToTournament(data.tournamentId, {
      type: 'prize_distributed',
      tournamentId: data.tournamentId,
      data,
      timestamp: new Date(),
    });
  }

  @OnEvent('tournament.completed')
  async handleTournamentCompleted(data: any) {
    this.broadcastToTournament(data.id, {
      type: 'tournament_completed',
      tournamentId: data.id,
      data,
      timestamp: new Date(),
    });
  }

  // Helper methods
  private extractTokenFromHandshake(client: Socket): string | null {
    const authHeader =
      client.handshake.auth?.token || client.handshake.headers?.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    return (client.handshake.query?.token as string) || null;
  }

  private async checkTournamentAccess(
    userId: string,
    tournamentId: string,
  ): Promise<boolean> {
    try {
      const tournament =
        await this.tournamentService.getTournament(tournamentId);

      // Tournament owner has access
      if (tournament.createdBy === userId) {
        return true;
      }

      // Participants have access
      const isParticipant = tournament.participants?.some(
        (p) => p.playerId === userId,
      );
      if (isParticipant) {
        return true;
      }

      // Public tournaments can be viewed by anyone
      if (tournament.isPublic) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Access check failed: ${error.message}`);
      return false;
    }
  }

  private async getCurrentTournamentState(tournamentId: string) {
    const [tournament, bracket, leaderboard, activeMatches] = await Promise.all(
      [
        this.tournamentService.getTournament(tournamentId),
        this.tournamentService.getTournamentBracket(tournamentId),
        this.tournamentService.getLeaderboard(tournamentId),
        this.tournamentService.getActiveMatches(tournamentId),
      ],
    );

    return {
      tournament,
      bracket,
      leaderboard,
      activeMatches,
      lastUpdated: new Date(),
    };
  }

  private broadcastToTournament(
    tournamentId: string,
    payload: TournamentUpdatePayload,
  ) {
    this.server
      .to(`tournament:${tournamentId}`)
      .emit('tournament_update', payload);
    this.logger.debug(
      `Broadcasted ${payload.type} to tournament ${tournamentId}`,
    );
  }

  private broadcastToRoom(room: string, payload: TournamentUpdatePayload) {
    this.server.to(room).emit('tournament_update', payload);
    this.logger.debug(`Broadcasted ${payload.type} to room ${room}`);
  }

  private async broadcastLeaderboardUpdate(tournamentId: string) {
    try {
      const leaderboard =
        await this.tournamentService.getLeaderboard(tournamentId);
      this.broadcastToTournament(tournamentId, {
        type: 'leaderboard_updated',
        tournamentId,
        data: leaderboard,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(
        `Failed to broadcast leaderboard update: ${error.message}`,
      );
    }
  }

  // Admin methods for broadcasting custom messages
  async broadcastSystemMessage(tournamentId: string, message: string) {
    this.broadcastToTournament(tournamentId, {
      type: 'system_message',
      tournamentId,
      data: { message },
      timestamp: new Date(),
    });
  }

  async broadcastTournamentAlert(tournamentId: string, alert: any) {
    this.broadcastToTournament(tournamentId, {
      type: 'tournament_alert',
      tournamentId,
      data: alert,
      timestamp: new Date(),
    });
  }

  // Get connected clients count for a tournament
  getTournamentViewerCount(tournamentId: string): number {
    const room = this.server.sockets.adapter.rooms.get(
      `tournament:${tournamentId}`,
    );
    return room?.size || 0;
  }

  // Get all connected clients count
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  // Force disconnect a client
  async disconnectClient(clientId: string, reason?: string) {
    const client = this.connectedClients.get(clientId);
    if (client) {
      client.emit('force_disconnect', {
        reason: reason || 'Disconnected by admin',
      });
      client.disconnect();
    }
  }
}
