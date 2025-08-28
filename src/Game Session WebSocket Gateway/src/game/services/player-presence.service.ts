import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Player } from "../entities/player.entity";
import { PlayerPresence } from "../interfaces/player.interface";

@Injectable()
export class PlayerPresenceService {
  private readonly logger = new Logger(PlayerPresenceService.name);
  private presenceMap: Map<string, PlayerPresence> = new Map();

  constructor(
    @InjectRepository(Player)
    private playerRepository: Repository<Player>
  ) {}

  async setPlayerOnline(playerId: string, socketId: string): Promise<void> {
    const presence = this.presenceMap.get(playerId) || {
      playerId,
      isOnline: false,
      lastSeen: new Date(),
      socketIds: [],
    };

    presence.isOnline = true;
    presence.lastSeen = new Date();
    if (!presence.socketIds.includes(socketId)) {
      presence.socketIds.push(socketId);
    }

    this.presenceMap.set(playerId, presence);

    // Update database
    await this.playerRepository.update(playerId, {
      isOnline: true,
      lastSeen: new Date(),
      socketId,
    });

    this.logger.log(`Player ${playerId} is now online with socket ${socketId}`);
  }

  async setPlayerOffline(playerId: string, socketId: string): Promise<void> {
    const presence = this.presenceMap.get(playerId);
    if (!presence) return;

    // Remove the specific socket ID
    presence.socketIds = presence.socketIds.filter((id) => id !== socketId);
    presence.lastSeen = new Date();

    // If no more socket connections, mark as offline
    if (presence.socketIds.length === 0) {
      presence.isOnline = false;

      await this.playerRepository.update(playerId, {
        isOnline: false,
        lastSeen: new Date(),
        socketId: null,
      });

      this.logger.log(`Player ${playerId} is now offline`);
    } else {
      // Update with remaining socket ID
      await this.playerRepository.update(playerId, {
        socketId: presence.socketIds[0],
        lastSeen: new Date(),
      });
    }

    this.presenceMap.set(playerId, presence);
  }

  getPlayerPresence(playerId: string): PlayerPresence | undefined {
    return this.presenceMap.get(playerId);
  }

  isPlayerOnline(playerId: string): boolean {
    const presence = this.presenceMap.get(playerId);
    return presence?.isOnline || false;
  }

  getOnlinePlayersInSession(sessionId: string): Promise<Player[]> {
    return this.playerRepository.find({
      where: {
        session: { id: sessionId },
        isOnline: true,
      },
      relations: ["session"],
    });
  }

  async cleanupStalePresences(): Promise<void> {
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const now = new Date();

    for (const [playerId, presence] of this.presenceMap.entries()) {
      if (now.getTime() - presence.lastSeen.getTime() > staleThreshold) {
        presence.isOnline = false;
        presence.socketIds = [];

        await this.playerRepository.update(playerId, {
          isOnline: false,
          lastSeen: presence.lastSeen,
          socketId: null,
        });

        this.logger.log(`Cleaned up stale presence for player ${playerId}`);
      }
    }
  }
}
