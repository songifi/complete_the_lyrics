import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Request } from 'express';
import { GameRoomEntity, RoomMemberEntity } from '../entities';
import { RoomAccessType, RoomRole, RoomStatus } from '../enums';
import { AuthenticatedRequest } from '../interfaces';

@Injectable()
export class RoomAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(GameRoomEntity)
    private roomRepository: Repository<GameRoomEntity>,
    @InjectRepository(RoomMemberEntity)
    private roomMemberRepository: Repository<RoomMemberEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    const roomId = request.params.roomId || request.params.id;
    if (!roomId) {
      throw new BadRequestException('Room ID is required');
    }

    // Find the room
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new ForbiddenException('Room not found');
    }

    // Check if room is active
    if (room.status !== RoomStatus.ACTIVE) {
      throw new ForbiddenException('Room is not active');
    }

    // Check if room is locked
    if (room.isLocked && !room.isOwner(user.id) && !room.isModerator(user.id)) {
      throw new ForbiddenException('Room is locked');
    }

    // Check if user is banned
    if (room.bannedUsers.includes(user.id)) {
      throw new ForbiddenException('User is banned from this room');
    }

    // Check room access based on type
    switch (room.accessType) {
      case RoomAccessType.PUBLIC:
        // Public rooms are accessible to all authenticated users
        return this.handlePublicRoomAccess(room, user, request);

      case RoomAccessType.PRIVATE:
        // Private rooms require invitation or ownership
        return this.handlePrivateRoomAccess(room, user);

      case RoomAccessType.PASSWORD_PROTECTED:
        // Password-protected rooms require password verification
        return this.handlePasswordProtectedRoomAccess(room, user, request);

      default:
        throw new ForbiddenException('Invalid room access type');
    }
  }

  private async handlePublicRoomAccess(
    room: GameRoomEntity,
    user: AuthenticatedRequest['user'],
    request: AuthenticatedRequest,
  ): Promise<boolean> {
    // Check if room has capacity (for joining operations)
    if (this.isJoinOperation(request) && room.isFull()) {
      throw new ForbiddenException('Room is full');
    }

    // Check if guest users are allowed
    if (!room.configuration.allowGuestUsers && user.role === 'guest') {
      throw new ForbiddenException('Guest users are not allowed in this room');
    }

    return true;
  }

  private async handlePrivateRoomAccess(
    room: GameRoomEntity,
    user: AuthenticatedRequest['user'],
  ): Promise<boolean> {
    // Owner always has access
    if (room.isOwner(user.id)) {
      return true;
    }

    // Check if user is invited
    if (!room.invitedUsers.includes(user.id)) {
      throw new ForbiddenException('User is not invited to this private room');
    }

    return true;
  }

  private async handlePasswordProtectedRoomAccess(
    room: GameRoomEntity,
    user: AuthenticatedRequest['user'],
    request: AuthenticatedRequest,
  ): Promise<boolean> {
    // Owner and moderators don't need password
    if (room.isOwner(user.id) || room.isModerator(user.id)) {
      return true;
    }

    // Check if user is already a member
    const existingMember = await this.roomMemberRepository.findOne({
      where: { roomId: room.id, userId: user.id },
    });

    if (existingMember) {
      return true;
    }

    // For joining operations, password is required
    if (this.isJoinOperation(request)) {
      const password = request.body?.password;
      if (!password) {
        throw new BadRequestException('Password is required for this room');
      }

      const isPasswordValid = await bcrypt.compare(password, room.passwordHash);
      if (!isPasswordValid) {
        throw new ForbiddenException('Invalid password');
      }

      // Check room capacity
      if (room.isFull()) {
        throw new ForbiddenException('Room is full');
      }
    }

    return true;
  }

  private isJoinOperation(request: AuthenticatedRequest): boolean {
    return request.method === 'POST' && request.url.includes('/join');
  }
}
