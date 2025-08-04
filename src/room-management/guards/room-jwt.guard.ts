import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRoomEntity, RoomMemberEntity } from '../entities';

export interface RoomJwtPayload {
  userId: string;
  username: string;
  roomId: string;
  role: string;
  permissions: string[];
  iat: number;
  exp: number;
}

@Injectable()
export class RoomJwtGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    @InjectRepository(GameRoomEntity)
    private roomRepository: Repository<GameRoomEntity>,
    @InjectRepository(RoomMemberEntity)
    private roomMemberRepository: Repository<RoomMemberEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Room token is required');
    }

    try {
      // Verify and decode the JWT token
      const payload = await this.jwtService.verifyAsync<RoomJwtPayload>(token, {
        secret: process.env.ROOM_JWT_SECRET || 'room-secret',
      });

      // Validate token payload
      if (!payload.roomId || !payload.userId) {
        throw new UnauthorizedException('Invalid room token payload');
      }

      // Get room ID from request params
      const roomId = request.params.roomId || request.params.id;

      // Verify token is for the correct room
      if (payload.roomId !== roomId) {
        throw new UnauthorizedException('Token is not valid for this room');
      }

      // Verify room still exists and is active
      const room = await this.roomRepository.findOne({
        where: { id: payload.roomId },
      });

      if (!room) {
        throw new UnauthorizedException('Room no longer exists');
      }

      // Verify user is still a member of the room
      const member = await this.roomMemberRepository.findOne({
        where: { roomId: payload.roomId, userId: payload.userId },
      });

      if (!member) {
        throw new UnauthorizedException('User is no longer a member of this room');
      }

      // Check if user is banned or muted
      if (member.isBanned) {
        throw new UnauthorizedException('User is banned from this room');
      }

      // Verify token hasn't been invalidated by role/permission changes
      if (this.hasRoleChanged(payload, member)) {
        throw new UnauthorizedException('Token is outdated due to role changes');
      }

      // Attach user and room information to request
      request.user = {
        id: payload.userId,
        username: payload.username,
        roomRole: member.role,
        permissions: member.permissions,
      };

      request.room = room;
      request.roomMember = member;

      return true;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid room token');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return undefined;
    }

    const [type, token] = authHeader.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }

  private hasRoleChanged(payload: RoomJwtPayload, member: RoomMemberEntity): boolean {
    // Check if role has changed
    if (payload.role !== member.role) {
      return true;
    }

    // Check if permissions have changed significantly
    const tokenPermissions = new Set(payload.permissions);
    const currentPermissions = new Set(member.permissions);

    // If the user lost any permissions, invalidate token
    for (const permission of tokenPermissions) {
      if (!currentPermissions.has(permission)) {
        return true;
      }
    }

    return false;
  }
}

@Injectable()
export class RoomJwtService {
  constructor(private jwtService: JwtService) {}

  async generateRoomToken(
    userId: string,
    username: string,
    roomId: string,
    role: string,
    permissions: string[],
    expiresIn: string = '24h',
  ): Promise<string> {
    const payload: Omit<RoomJwtPayload, 'iat' | 'exp'> = {
      userId,
      username,
      roomId,
      role,
      permissions,
    };

    return this.jwtService.signAsync(payload, {
      secret: process.env.ROOM_JWT_SECRET || 'room-secret',
      expiresIn,
    });
  }

  async verifyRoomToken(token: string): Promise<RoomJwtPayload> {
    return this.jwtService.verifyAsync<RoomJwtPayload>(token, {
      secret: process.env.ROOM_JWT_SECRET || 'room-secret',
    });
  }

  async refreshRoomToken(
    oldToken: string,
    member: RoomMemberEntity,
    expiresIn: string = '24h',
  ): Promise<string> {
    try {
      const payload = await this.verifyRoomToken(oldToken);

      return this.generateRoomToken(
        member.userId,
        member.username,
        member.roomId,
        member.role,
        member.permissions,
        expiresIn,
      );
    } catch (error) {
      throw new UnauthorizedException('Cannot refresh invalid token');
    }
  }
}
