import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, MoreThan } from 'typeorm';
import {
  GameRoomEntity,
  RoomMemberEntity,
  RoomModerationEntity,
  RoomActivityEntity,
} from '../entities';
import {
  ModerationActionDto,
  KickUserDto,
  BanUserDto,
  MuteUserDto,
  UnbanUserDto,
  UnmuteUserDto,
} from '../dto';
import { ModerationAction, RoomRole } from '../enums';

@Injectable()
export class RoomModerationService {
  private readonly logger = new Logger(RoomModerationService.name);

  constructor(
    @InjectRepository(GameRoomEntity)
    private roomRepository: Repository<GameRoomEntity>,
    @InjectRepository(RoomMemberEntity)
    private roomMemberRepository: Repository<RoomMemberEntity>,
    @InjectRepository(RoomModerationEntity)
    private roomModerationRepository: Repository<RoomModerationEntity>,
    @InjectRepository(RoomActivityEntity)
    private roomActivityRepository: Repository<RoomActivityEntity>,
    private dataSource: DataSource,
  ) {}

  async kickUser(
    roomId: string,
    kickUserDto: KickUserDto,
    moderatorId: string,
    moderatorUsername: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { targetUserId, reason } = kickUserDto;

      // Validate moderation action
      await this.validateModerationAction(roomId, moderatorId, targetUserId, queryRunner.manager);

      const targetMember = await queryRunner.manager.findOne(RoomMemberEntity, {
        where: { roomId, userId: targetUserId },
      });

      if (!targetMember) {
        throw new NotFoundException('Target user is not a member of this room');
      }

      // Remove the user from the room
      await queryRunner.manager.remove(targetMember);

      // Update room capacity
      await queryRunner.manager.decrement(GameRoomEntity, { id: roomId }, 'currentCapacity', 1);

      // Log moderation action
      await this.logModerationAction(
        roomId,
        moderatorId,
        moderatorUsername,
        targetUserId,
        targetMember.username,
        ModerationAction.KICK,
        reason,
        null,
        queryRunner.manager,
      );

      // Log activity
      await this.logRoomActivity(
        roomId,
        'user_kicked',
        moderatorId,
        moderatorUsername,
        {
          targetUserId,
          targetUsername: targetMember.username,
          reason,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      this.logger.log(`User ${targetUserId} kicked from room ${roomId} by ${moderatorId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async banUser(
    roomId: string,
    banUserDto: BanUserDto,
    moderatorId: string,
    moderatorUsername: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { targetUserId, reason, duration } = banUserDto;

      // Validate moderation action
      await this.validateModerationAction(roomId, moderatorId, targetUserId, queryRunner.manager);

      const room = await queryRunner.manager.findOne(GameRoomEntity, {
        where: { id: roomId },
      });

      const targetMember = await queryRunner.manager.findOne(RoomMemberEntity, {
        where: { roomId, userId: targetUserId },
      });

      if (!targetMember) {
        throw new NotFoundException('Target user is not a member of this room');
      }

      // Add user to banned list
      if (!room.bannedUsers.includes(targetUserId)) {
        room.bannedUsers.push(targetUserId);
        await queryRunner.manager.save(room);
      }

      // Update member ban status
      targetMember.isBanned = true;
      targetMember.banReason = reason;
      targetMember.bannedBy = moderatorId;

      if (duration) {
        targetMember.banExpiresAt = new Date(Date.now() + duration * 60 * 1000);
      }

      await queryRunner.manager.save(targetMember);

      // Calculate expiration date
      const expiresAt = duration ? new Date(Date.now() + duration * 60 * 1000) : null;

      // Log moderation action
      await this.logModerationAction(
        roomId,
        moderatorId,
        moderatorUsername,
        targetUserId,
        targetMember.username,
        ModerationAction.BAN,
        reason,
        expiresAt,
        queryRunner.manager,
      );

      // Log activity
      await this.logRoomActivity(
        roomId,
        'user_banned',
        moderatorId,
        moderatorUsername,
        {
          targetUserId,
          targetUsername: targetMember.username,
          reason,
          duration,
          temporary: !!duration,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      this.logger.log(`User ${targetUserId} banned from room ${roomId} by ${moderatorId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async muteUser(
    roomId: string,
    muteUserDto: MuteUserDto,
    moderatorId: string,
    moderatorUsername: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { targetUserId, reason, duration } = muteUserDto;

      // Validate moderation action
      await this.validateModerationAction(roomId, moderatorId, targetUserId, queryRunner.manager);

      const targetMember = await queryRunner.manager.findOne(RoomMemberEntity, {
        where: { roomId, userId: targetUserId },
      });

      if (!targetMember) {
        throw new NotFoundException('Target user is not a member of this room');
      }

      // Update member mute status
      targetMember.isMuted = true;
      targetMember.muteReason = reason;
      targetMember.mutedBy = moderatorId;

      if (duration) {
        targetMember.muteExpiresAt = new Date(Date.now() + duration * 60 * 1000);
      }

      await queryRunner.manager.save(targetMember);

      // Calculate expiration date
      const expiresAt = duration ? new Date(Date.now() + duration * 60 * 1000) : null;

      // Log moderation action
      await this.logModerationAction(
        roomId,
        moderatorId,
        moderatorUsername,
        targetUserId,
        targetMember.username,
        ModerationAction.MUTE,
        reason,
        expiresAt,
        queryRunner.manager,
      );

      // Log activity
      await this.logRoomActivity(
        roomId,
        'user_muted',
        moderatorId,
        moderatorUsername,
        {
          targetUserId,
          targetUsername: targetMember.username,
          reason,
          duration,
          temporary: !!duration,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      this.logger.log(`User ${targetUserId} muted in room ${roomId} by ${moderatorId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async unbanUser(
    roomId: string,
    unbanUserDto: UnbanUserDto,
    moderatorId: string,
    moderatorUsername: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { targetUserId, reason } = unbanUserDto;

      const room = await queryRunner.manager.findOne(GameRoomEntity, {
        where: { id: roomId },
      });

      const targetMember = await queryRunner.manager.findOne(RoomMemberEntity, {
        where: { roomId, userId: targetUserId },
      });

      if (!targetMember) {
        throw new NotFoundException('Target user is not a member of this room');
      }

      if (!targetMember.isBanned) {
        throw new BadRequestException('User is not banned');
      }

      // Remove from banned list
      room.bannedUsers = room.bannedUsers.filter((id) => id !== targetUserId);
      await queryRunner.manager.save(room);

      // Update member ban status
      targetMember.isBanned = false;
      targetMember.banReason = null;
      targetMember.bannedBy = null;
      targetMember.banExpiresAt = null;

      await queryRunner.manager.save(targetMember);

      // Log moderation action
      await this.logModerationAction(
        roomId,
        moderatorId,
        moderatorUsername,
        targetUserId,
        targetMember.username,
        ModerationAction.UNBAN,
        reason,
        null,
        queryRunner.manager,
      );

      // Log activity
      await this.logRoomActivity(
        roomId,
        'user_unbanned',
        moderatorId,
        moderatorUsername,
        {
          targetUserId,
          targetUsername: targetMember.username,
          reason,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      this.logger.log(`User ${targetUserId} unbanned from room ${roomId} by ${moderatorId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async unmuteUser(
    roomId: string,
    unmuteUserDto: UnmuteUserDto,
    moderatorId: string,
    moderatorUsername: string,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const { targetUserId, reason } = unmuteUserDto;

      const targetMember = await queryRunner.manager.findOne(RoomMemberEntity, {
        where: { roomId, userId: targetUserId },
      });

      if (!targetMember) {
        throw new NotFoundException('Target user is not a member of this room');
      }

      if (!targetMember.isMuted) {
        throw new BadRequestException('User is not muted');
      }

      // Update member mute status
      targetMember.isMuted = false;
      targetMember.muteReason = null;
      targetMember.mutedBy = null;
      targetMember.muteExpiresAt = null;

      await queryRunner.manager.save(targetMember);

      // Log moderation action
      await this.logModerationAction(
        roomId,
        moderatorId,
        moderatorUsername,
        targetUserId,
        targetMember.username,
        ModerationAction.UNMUTE,
        reason,
        null,
        queryRunner.manager,
      );

      // Log activity
      await this.logRoomActivity(
        roomId,
        'user_unmuted',
        moderatorId,
        moderatorUsername,
        {
          targetUserId,
          targetUsername: targetMember.username,
          reason,
        },
        queryRunner.manager,
      );

      await queryRunner.commitTransaction();

      this.logger.log(`User ${targetUserId} unmuted in room ${roomId} by ${moderatorId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getModerationHistory(roomId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [history, total] = await this.roomModerationRepository.findAndCount({
      where: { roomId },
      order: { timestamp: 'DESC' },
      skip,
      take: limit,
    });

    return {
      history,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async checkExpiredModerations(): Promise<void> {
    const now = new Date();

    // Find expired mutes
    const expiredMutes = await this.roomMemberRepository.find({
      where: {
        isMuted: true,
        muteExpiresAt: MoreThan(new Date(0)), // Has expiration date
      },
    });

    // Find expired bans
    const expiredBans = await this.roomMemberRepository.find({
      where: {
        isBanned: true,
        banExpiresAt: MoreThan(new Date(0)), // Has expiration date
      },
    });

    // Process expired mutes
    for (const member of expiredMutes) {
      if (member.shouldUnmute()) {
        member.isMuted = false;
        member.muteReason = null;
        member.mutedBy = null;
        member.muteExpiresAt = null;

        await this.roomMemberRepository.save(member);

        // Log automatic unmute
        await this.logRoomActivity(member.roomId, 'user_auto_unmuted', 'system', 'System', {
          targetUserId: member.userId,
          targetUsername: member.username,
          reason: 'Mute expired',
        });

        this.logger.log(`Auto-unmuted user ${member.userId} in room ${member.roomId}`);
      }
    }

    // Process expired bans
    for (const member of expiredBans) {
      if (member.shouldUnban()) {
        const room = await this.roomRepository.findOne({
          where: { id: member.roomId },
        });

        if (room) {
          // Remove from banned list
          room.bannedUsers = room.bannedUsers.filter((id) => id !== member.userId);
          await this.roomRepository.save(room);
        }

        member.isBanned = false;
        member.banReason = null;
        member.bannedBy = null;
        member.banExpiresAt = null;

        await this.roomMemberRepository.save(member);

        // Log automatic unban
        await this.logRoomActivity(member.roomId, 'user_auto_unbanned', 'system', 'System', {
          targetUserId: member.userId,
          targetUsername: member.username,
          reason: 'Ban expired',
        });

        this.logger.log(`Auto-unbanned user ${member.userId} in room ${member.roomId}`);
      }
    }
  }

  private async validateModerationAction(
    roomId: string,
    moderatorId: string,
    targetUserId: string,
    manager: any,
  ): Promise<void> {
    // Find moderator member
    const moderator = await manager.findOne(RoomMemberEntity, {
      where: { roomId, userId: moderatorId },
    });

    if (!moderator) {
      throw new ForbiddenException('Moderator is not a member of this room');
    }

    if (!moderator.canModerate()) {
      throw new ForbiddenException('Insufficient moderation permissions');
    }

    // Find target member
    const target = await manager.findOne(RoomMemberEntity, {
      where: { roomId, userId: targetUserId },
    });

    if (!target) {
      throw new NotFoundException('Target user is not a member of this room');
    }

    // Role hierarchy check
    const roleHierarchy = {
      [RoomRole.GUEST]: 0,
      [RoomRole.MEMBER]: 1,
      [RoomRole.MODERATOR]: 2,
      [RoomRole.OWNER]: 3,
    };

    const moderatorLevel = roleHierarchy[moderator.role];
    const targetLevel = roleHierarchy[target.role];

    if (moderatorLevel <= targetLevel) {
      throw new ForbiddenException('Cannot moderate a user with equal or higher role');
    }
  }

  private async logModerationAction(
    roomId: string,
    moderatorId: string,
    moderatorUsername: string,
    targetUserId: string,
    targetUsername: string,
    action: ModerationAction,
    reason: string | null,
    expiresAt: Date | null,
    manager: any,
  ): Promise<void> {
    const moderationRecord = manager.create(RoomModerationEntity, {
      roomId,
      moderatorId,
      moderatorUsername,
      targetUserId,
      targetUsername,
      action,
      reason,
      expiresAt,
      duration: expiresAt ? Math.floor((expiresAt.getTime() - Date.now()) / (60 * 1000)) : null,
      metadata: {},
    });

    await manager.save(moderationRecord);

    // Update room analytics
    const room = await manager.findOne(GameRoomEntity, { where: { id: roomId } });
    if (room && room.analytics) {
      room.analytics.moderationActions = (room.analytics.moderationActions || 0) + 1;
      await manager.save(room);
    }
  }

  private async logRoomActivity(
    roomId: string,
    eventType: string,
    userId: string,
    username: string,
    metadata: Record<string, any>,
    manager?: any,
  ): Promise<void> {
    const activity = (manager || this.roomActivityRepository).create(RoomActivityEntity, {
      roomId,
      eventType,
      userId,
      username,
      metadata,
    });

    await (manager || this.roomActivityRepository).save(activity);
  }
}
