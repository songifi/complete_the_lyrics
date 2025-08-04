import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameRoomEntity, RoomMemberEntity } from '../entities';
import { RoomRole } from '../enums';
import { AuthenticatedRequest } from '../interfaces';

export const REQUIRED_ROOM_ROLE = 'requiredRoomRole';
export const REQUIRED_ROOM_PERMISSION = 'requiredRoomPermission';

@Injectable()
export class RoomModerationGuard implements CanActivate {
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

    // Get required role and permissions from decorator
    const requiredRole = this.reflector.get<RoomRole>(REQUIRED_ROOM_ROLE, context.getHandler());
    const requiredPermission = this.reflector.get<string>(
      REQUIRED_ROOM_PERMISSION,
      context.getHandler(),
    );

    // Find the room
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new ForbiddenException('Room not found');
    }

    // Find user's membership in the room
    const member = await this.roomMemberRepository.findOne({
      where: { roomId: room.id, userId: user.id },
    });

    if (!member) {
      throw new ForbiddenException('User is not a member of this room');
    }

    // Check if user is banned or muted for moderation actions
    if (member.isBanned) {
      throw new ForbiddenException('User is banned from this room');
    }

    if (member.isMuted && this.isModerationAction(request)) {
      throw new ForbiddenException('User is muted and cannot perform moderation actions');
    }

    // Check role-based access
    if (requiredRole) {
      if (!this.hasRequiredRole(member, requiredRole)) {
        throw new ForbiddenException(`Insufficient permissions. Required role: ${requiredRole}`);
      }
    }

    // Check permission-based access
    if (requiredPermission) {
      if (!this.hasRequiredPermission(member, requiredPermission)) {
        throw new ForbiddenException(
          `Insufficient permissions. Required permission: ${requiredPermission}`,
        );
      }
    }

    // Additional checks for moderation actions
    if (this.isModerationAction(request)) {
      return this.validateModerationAction(room, member, request);
    }

    return true;
  }

  private hasRequiredRole(member: RoomMemberEntity, requiredRole: RoomRole): boolean {
    const roleHierarchy = {
      [RoomRole.GUEST]: 0,
      [RoomRole.MEMBER]: 1,
      [RoomRole.MODERATOR]: 2,
      [RoomRole.OWNER]: 3,
    };

    const memberRoleLevel = roleHierarchy[member.role];
    const requiredRoleLevel = roleHierarchy[requiredRole];

    return memberRoleLevel >= requiredRoleLevel;
  }

  private hasRequiredPermission(member: RoomMemberEntity, permission: string): boolean {
    // Owner has all permissions
    if (member.isOwner()) {
      return true;
    }

    return member.permissions.includes(permission);
  }

  private isModerationAction(request: AuthenticatedRequest): boolean {
    const moderationEndpoints = ['/kick', '/ban', '/mute', '/unban', '/unmute', '/moderate'];
    return moderationEndpoints.some((endpoint) => request.url.includes(endpoint));
  }

  private async validateModerationAction(
    room: GameRoomEntity,
    moderator: RoomMemberEntity,
    request: AuthenticatedRequest,
  ): Promise<boolean> {
    // Get target user from request
    const targetUserId = request.body?.targetUserId || request.params?.targetUserId;

    if (!targetUserId) {
      throw new BadRequestException('Target user ID is required for moderation actions');
    }

    // Cannot moderate yourself
    if (targetUserId === moderator.userId) {
      throw new ForbiddenException('Cannot moderate yourself');
    }

    // Find target member
    const targetMember = await this.roomMemberRepository.findOne({
      where: { roomId: room.id, userId: targetUserId },
    });

    if (!targetMember) {
      throw new ForbiddenException('Target user is not a member of this room');
    }

    // Role hierarchy validation
    if (!this.canModerateUser(moderator, targetMember)) {
      throw new ForbiddenException('Cannot moderate a user with equal or higher role');
    }

    // Special validation for ownership transfer
    if (request.url.includes('/transfer-ownership')) {
      if (!moderator.isOwner()) {
        throw new ForbiddenException('Only room owner can transfer ownership');
      }
    }

    return true;
  }

  private canModerateUser(moderator: RoomMemberEntity, target: RoomMemberEntity): boolean {
    const roleHierarchy = {
      [RoomRole.GUEST]: 0,
      [RoomRole.MEMBER]: 1,
      [RoomRole.MODERATOR]: 2,
      [RoomRole.OWNER]: 3,
    };

    const moderatorLevel = roleHierarchy[moderator.role];
    const targetLevel = roleHierarchy[target.role];

    // Can only moderate users with lower role level
    return moderatorLevel > targetLevel;
  }
}

// Decorators for setting required roles and permissions
export const RequireRoomRole = (role: RoomRole) => SetMetadata(REQUIRED_ROOM_ROLE, role);

export const RequireRoomPermission = (permission: string) =>
  SetMetadata(REQUIRED_ROOM_PERMISSION, permission);
