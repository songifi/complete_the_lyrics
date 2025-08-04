import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRoomEntity } from '../entities/game-room.entity';
import { RoomMemberEntity } from '../entities/room-member.entity';
import { AuthenticatedUser } from '../interfaces';
import { JwtPayload } from './jwt.strategy';

export interface RoomJwtPayload extends JwtPayload {
  roomId: string;
  roomRole?: string;
  roomPermissions?: string[];
}

export interface RoomAuthenticatedUser extends AuthenticatedUser {
  roomId: string;
  roomRole?: string;
  roomPermissions?: string[];
  roomMember?: RoomMemberEntity;
}

@Injectable()
export class RoomJwtStrategy extends PassportStrategy(Strategy, 'room-jwt') {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(GameRoomEntity)
    private readonly roomRepository: Repository<GameRoomEntity>,
    @InjectRepository(RoomMemberEntity)
    private readonly memberRepository: Repository<RoomMemberEntity>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'default-secret'),
    });
  }

  async validate(payload: RoomJwtPayload): Promise<RoomAuthenticatedUser> {
    if (!payload.sub || !payload.username || !payload.roomId) {
      throw new UnauthorizedException('Invalid room token payload');
    }

    // Verify the room exists and is active
    const room = await this.roomRepository.findOne({
      where: { id: payload.roomId },
    });

    if (!room) {
      throw new UnauthorizedException('Room not found or inactive');
    }

    if (room.isArchived) {
      throw new UnauthorizedException('Room is archived');
    }

    // Verify user is a member of the room
    const member = await this.memberRepository.findOne({
      where: {
        roomId: payload.roomId,
        userId: payload.sub,
      },
      relations: ['room'],
    });

    if (!member) {
      throw new UnauthorizedException('User is not a member of this room');
    }

    // Check if user is banned
    if (member.isBanned && (!member.banExpiresAt || member.banExpiresAt > new Date())) {
      throw new UnauthorizedException('User is banned from this room');
    }

    return {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      role: payload.role,
      roomId: payload.roomId,
      roomRole: member.role,
      roomPermissions: member.permissions,
      roomMember: member,
    };
  }
}
