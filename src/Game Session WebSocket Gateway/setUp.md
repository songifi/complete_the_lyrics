## 8. Client-side Example Usage

### JavaScript/TypeScript Client Example

```typescript
import { io, Socket } from "socket.io-client";

class GameClient {
  private socket: Socket;
  private playerId: string;
  private sessionId?: string;

  constructor(serverUrl: string, playerId: string) {
    this.playerId = playerId;
    this.socket = io(serverUrl, {
      path: "/game-socket",
      query: { playerId },
      transports: ["websocket", "polling"],
      forceNew: true,
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Connection events
    this.socket.on("connection:established", (data) => {
      console.log("Connected to server:", data);
    });

    // Session events
    this.socket.on("session:created", (data) => {
      console.log("Session created:", data);
      this.sessionId = data.session.id;
    });

    this.socket.on("session:joined", (data) => {
      console.log("Joined session:", data);
      this.sessionId = data.session.id;
    });

    this.socket.on("player:joined", (data) => {
      console.log("Player joined:", data);
      this.updatePlayerList(data.onlinePlayers);
    });

    this.socket.on("player:left", (data) => {
      console.log("Player left:", data);
    });

    // Chat events
    this.socket.on("chat:message", (message) => {
      console.log("New message:", message);
      this.displayMessage(message);
    });

    // Session state events
    this.socket.on("session:stateUpdated", (data) => {
      console.log("Session state updated:", data);
      this.updateGameState(data);
    });

    // Reconnection events
    this.socket.on("session:reconnected", (data) => {
      console.log("Reconnected successfully:", data);
      this.sessionId = data.session.id;
      this.restoreGameState(data);
    });

    // Error handling
    this.socket.on("session:error", (error) => {
      console.error("Session error:", error);
    });

    // Connection management
    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
      this.attemptReconnection();
    });
  }

  // Public methods
  createSession(sessionData: any) {
    this.socket.emit("session:create", sessionData);
  }

  joinSession(sessionId: string, username: string) {
    this.socket.emit("session:join", {
      sessionId,
      username,
      role: "player",
    });
  }

  sendChatMessage(content: string) {
    this.socket.emit("chat:send", {
      content,
      type: "chat",
    });
  }

  updateGameState(gameData: any) {
    if (this.sessionId) {
      this.socket.emit("session:updateState", {
        sessionId: this.sessionId,
        gameData,
      });
    }
  }

  leaveSession() {
    this.socket.emit("session:leave");
  }

  startHeartbeat() {
    setInterval(() => {
      this.socket.emit("presence:heartbeat");
    }, 30000); // Every 30 seconds
  }

  private attemptReconnection() {
    setTimeout(() => {
      this.socket.emit("session:reconnect", {
        playerId: this.playerId,
      });
    }, 2000);
  }

  private updatePlayerList(players: any[]) {
    // Update UI with current players
  }

  private displayMessage(message: any) {
    // Display chat message in UI
  }

  private updateGameState(stateData: any) {
    // Update game state in UI
  }

  private restoreGameState(data: any) {
    // Restore game state after reconnection
    this.updatePlayerList(data.onlinePlayers);
    data.chatHistory.forEach((message: any) => {
      this.displayMessage(message);
    });
  }
}

// Usage
const gameClient = new GameClient("http://localhost:3000", "player123");
gameClient.startHeartbeat();
```

## 9. Installation and Setup

### Package.json dependencies to add:

```json
{
  "dependencies": {
    "@nestjs/websockets": "^10.0.0",
    "@nestjs/platform-socket.io": "^10.0.0",
    "socket.io": "^4.7.0",
    "class-validator": "^0.14.0",
    "class-transformer": "^0.5.0"
  }
}
```

### Database Setup (TypeORM)

Add to your app.module.ts:

```typescript
TypeOrmModule.forRoot({
  // your database config
  entities: [GameSession, Player, ChatMessage],
  synchronize: true, // Only for development
});
```

This implementation provides:

**Real-time WebSocket communication**
**Room-based session management**  
 **Player presence tracking**
**Connection recovery mechanisms**
**Session state synchronization**
**Real-time chat functionality**
**Event broadcasting**
**Graceful error handling**
**Proper file organization**
**TypeScript types throughout**

The system handles disconnections, supports reconnection with state recovery, manages player presence, and provides real-time updates across all connected clients in the same game session.id
);
}

    this.connectionRecoveryService.removeConnectionState(client.id);

}

@SubscribeMessage('session:create')
async handleCreateSession(
@ConnectedSocket() client: Socket,
@MessageBody() createSessionDto: CreateSessionDto,
) {
try {
const playerId = this.getPlayerIdFromSocket(client);
const session = await this.gameSessionService.createSession(createSessionDto, playerId);

      // Create room and join
      this.roomManagerService.createRoom(session.id);
      this.roomManagerService.joinRoom(session.id, client);

      // Set up presence and connection state
      await this.playerPresenceService.setPlayerOnline(playerId, client.id);
      this.connectionRecoveryService.saveConnectionState(client, playerId, session.id);

      client.
