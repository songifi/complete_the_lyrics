import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';

interface AuthenticatedSocket extends Socket {
  userId?: string;
}

@Injectable()
export class WsJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client: AuthenticatedSocket = context.switchToWs().getClient();

    try {
      const token = this.extractTokenFromSocket(client);
      if (!token) {
        throw new WsException('Access token is required');
      }

      const payload = await this.jwtService.verifyAsync(token);
      client.userId = payload.sub || payload.id;

      return true;
    } catch (error) {
      throw new WsException('Invalid access token');
    }
  }

  private extractTokenFromSocket(client: Socket): string | null {
    // Check auth object first
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token;
    }

    // Check authorization header
    const authHeader = client.handshake.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // Check query parameters
    if (client.handshake.query?.token) {
      return client.handshake.query.token as string;
    }

    return null;
  }
}
