import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Like } from 'typeorm';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import * as bcrypt from 'bcrypt';
import {
  GameRoomEntity,
  RoomMemberEntity,
  RoomActivityEntity,
  RoomTemplateEntity,
} from '../entities';
import { CreateRoomDto, JoinRoomDto, UpdateRoomDto, RoomQueryDto } from '../dto';
import { RoomAccessType, RoomStatus, RoomRole } from '../enums';
import { RoomConfiguration, RoomAnalytics } from '../interfaces';
import { RoomJwtService } from '../guards/room-jwt.guard';

@Injectable()
export class RoomManagementService {
  private readonly logger = new Logger(RoomManagementService.name);

  constructor(
    @InjectRepository(GameRoomEntity)
    private roomRepository: Repository<GameRoomEntity>,
    @InjectRepository(RoomMemberEntity)
    private roomMemberRepository: Repository<RoomMemberEntity>,
    @InjectRepository(RoomActivityEntity)
    private roomActivityRepository: Repository<RoomActivityEntity>,
    @InjectRepository(RoomTemplateEntity)
    private roomTemplateRepository: Repository<RoomTemplateEntity>,
    @InjectQueue('room-cleanup')
    private roomCleanupQueue: Queue,
    private dataSource: DataSource,
    private roomJwtService: RoomJwtService,
  ) {}

  async createRoom(
    createRoomDto: CreateRoomDto,
    userId: string,
    username: string,
  ): Promise<{ room: GameRoomEntity; token: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate template if provided
      let templateConfiguration: RoomConfiguration | null = null;
      if (createRoomDto.templateId) {
        const template = await this.roomTemplateRepository.findOne({
          where: { id: createRoomDto.templateId, isActive: true },
        });

        if (!template) {
          throw new BadRequestException('Template not found or inactive');
        }

        templateConfiguration = template.configuration;

        // Increment usage count
        await queryRunner.manager.increment(
          RoomTemplateEntity,
          { id: template.id },
          'usageCount',
          1,
        );
      }

      // Merge template configuration with provided configuration
      const finalConfiguration: RoomConfiguration = {
        ...templateConfiguration,
        ...createRoomDto.configuration,
      };

      // Hash password if provided
      let passwordHash: string | null = null;
      let passwordSalt = '';

      if (
        createRoomDto.accessType === RoomAccessType.PASSWORD_PROTECTED &&
        createRoomDto.password
      ) {
        passwordSalt = await bcrypt.genSalt(12);
        passwordHash = await bcrypt.hash(createRoomDto.password, passwordSalt);
      }

      // Create initial analytics
      const initialAnalytics: RoomAnalytics = {
        totalMembers: 1,
        activeMembers: 1,
        peakConcurrency: 1,
        averageSessionDuration: 0,
        messageCount: 0,
        moderationActions: 0,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      // Create room
      const room = queryRunner.manager.create(GameRoomEntity, {
        name: createRoomDto.name,
        description: createRoomDto.description,
        tag: createRoomDto.tag,
        accessType: createRoomDto.accessType,
        passwordHash,
        passwordSalt,
        ownerId: userId,
        ownerUsername: username,
        currentCapacity: 1,
        configuration: finalConfiguration,
        analytics: initialAnalytics,
        metadata: createRoomDto.metadata || {},
        invitedUsers: createRoomDto.invitedUsers || [],
        templateId: createRoomDto.templateId,
        lastActivityAt: new Date(),
      });

      const savedRoom = await queryRunner.manager.save(room);

      // Add owner as member
      const ownerMember = queryRunner.manager.create(RoomMemberEntity, {
        roomId: savedRoom.id,
        userId,
        username,
        role: RoomRole.OWNER,
        permissions: ['*'], // Owner has all permissions
        lastActivityAt: new Date(),
      });

      await queryRunner.manager.save(ownerMember);

      // Log room creation activity
      const activity = queryRunner.manager.create(RoomActivityEntity, {
        roomId: savedRoom.id,
        eventType: 'room_created',
        userId,
        username,
        metadata: {
          accessType: createRoomDto.accessType,
          hasTemplate: !!createRoomDto.templateId,
        },
      });

      await queryRunner.manager.save(activity);

      await queryRunner.commitTransaction();

      // Generate room token for owner
      const token = await this.roomJwtService.generateRoomToken(
        userId,
        username,
        savedRoom.id,
        RoomRole.OWNER,
        ['*'],
      );

      // Schedule room cleanup if inactive
      await this.scheduleRoomCleanup(savedRoom.id);

      this.logger.log(`Room created: ${savedRoom.id} by user: ${userId}`);

      return { room: savedRoom, token };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async joinRoom(
    roomId: string,
    joinRoomDto: JoinRoomDto,
    userId: string,
    username: string,
  ): Promise<{ room: GameRoomEntity; member: RoomMemberEntity; token: string }> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const room = await queryRunner.manager.findOne(GameRoomEntity, {
        where: { id: roomId },
      });

      if (!room) {
        throw new NotFoundException('Room not found');
      }

      // Validate room access
      if (!room.canJoin(userId)) {
        throw new ForbiddenException('Cannot join this room');
      }

      // Check if user is already a member
      const existingMember = await queryRunner.manager.findOne(RoomMemberEntity, {
        where: { roomId, userId },
      });

      if (existingMember) {
        throw new ConflictException('User is already a member of this room');
      }

      // Validate password for password-protected rooms
      if (room.hasPassword() && !room.isOwner(userId) && !room.isModerator(userId)) {
        if (!joinRoomDto.password) {
          throw new BadRequestException('Password is required');
        }

        const isPasswordValid = await bcrypt.compare(joinRoomDto.password, room.passwordHash);
        if (!isPasswordValid) {
          throw new ForbiddenException('Invalid password');
        }
      }

      // Create member
      const member = queryRunner.manager.create(RoomMemberEntity, {
        roomId,
        userId,
        username,
        role: room.configuration.allowGuestUsers ? RoomRole.MEMBER : RoomRole.GUEST,
        permissions: [],
        lastActivityAt: new Date(),
      });

      const savedMember = await queryRunner.manager.save(member);

      // Update room capacity
      await queryRunner.manager.increment(GameRoomEntity, { id: roomId }, 'currentCapacity', 1);

      // Update room analytics
      await this.updateRoomAnalytics(roomId, 'member_joined', queryRunner.manager);

      // Log join activity
      const activity = queryRunner.manager.create(RoomActivityEntity, {
        roomId,
        eventType: 'member_joined',
        userId,
        username,
        metadata: {
          role: member.role,
        },
      });

      await queryRunner.manager.save(activity);

      await queryRunner.commitTransaction();

      // Generate room token for member
      const token = await this.roomJwtService.generateRoomToken(
        userId,
        username,
        roomId,
        member.role,
        member.permissions,
      );

      this.logger.log(`User ${userId} joined room ${roomId}`);

      return { room, member: savedMember, token };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async leaveRoom(roomId: string, userId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const member = await queryRunner.manager.findOne(RoomMemberEntity, {
        where: { roomId, userId },
      });

      if (!member) {
        throw new NotFoundException('User is not a member of this room');
      }

      const room = await queryRunner.manager.findOne(GameRoomEntity, {
        where: { id: roomId },
      });

      if (!room) {
        throw new NotFoundException('Room not found');
      }

      // Handle owner leaving (transfer ownership or delete room)
      if (member.role === RoomRole.OWNER) {
        await this.handleOwnerLeaving(room, queryRunner.manager);
      }

      // Remove member
      await queryRunner.manager.remove(member);

      // Update room capacity
      await queryRunner.manager.decrement(GameRoomEntity, { id: roomId }, 'currentCapacity', 1);

      // Update room analytics
      await this.updateRoomAnalytics(roomId, 'member_left', queryRunner.manager);

      // Log leave activity
      const activity = queryRunner.manager.create(RoomActivityEntity, {
        roomId,
        eventType: 'member_left',
        userId,
        username: member.username,
        metadata: {
          role: member.role,
        },
      });

      await queryRunner.manager.save(activity);

      await queryRunner.commitTransaction();

      this.logger.log(`User ${userId} left room ${roomId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async updateRoom(
    roomId: string,
    updateRoomDto: UpdateRoomDto,
    userId: string,
  ): Promise<GameRoomEntity> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const room = await queryRunner.manager.findOne(GameRoomEntity, {
        where: { id: roomId },
      });

      if (!room) {
        throw new NotFoundException('Room not found');
      }

      if (!room.isOwner(userId) && !room.isModerator(userId)) {
        throw new ForbiddenException('Insufficient permissions to update room');
      }

      // Handle password update
      if (updateRoomDto.password) {
        const salt = await bcrypt.genSalt(12);
        room.passwordHash = await bcrypt.hash(updateRoomDto.password, salt);
        room.passwordSalt = salt;
      }

      // Update room properties
      Object.assign(room, {
        ...updateRoomDto,
        password: undefined, // Remove password from final object
        configuration: updateRoomDto.configuration
          ? { ...room.configuration, ...updateRoomDto.configuration }
          : room.configuration,
        metadata: updateRoomDto.metadata
          ? { ...room.metadata, ...updateRoomDto.metadata }
          : room.metadata,
      });

      const updatedRoom = await queryRunner.manager.save(room);

      // Log update activity
      const activity = queryRunner.manager.create(RoomActivityEntity, {
        roomId,
        eventType: 'room_updated',
        userId,
        username: room.ownerUsername,
        metadata: {
          changes: Object.keys(updateRoomDto),
        },
      });

      await queryRunner.manager.save(activity);

      await queryRunner.commitTransaction();

      this.logger.log(`Room ${roomId} updated by user ${userId}`);

      return updatedRoom;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getRooms(query: RoomQueryDto) {
    const queryBuilder = this.roomRepository.createQueryBuilder('room');

    // Apply filters
    if (query.search) {
      queryBuilder.andWhere('(room.name ILIKE :search OR room.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.accessType) {
      queryBuilder.andWhere('room.accessType = :accessType', {
        accessType: query.accessType,
      });
    }

    if (query.status) {
      queryBuilder.andWhere('room.status = :status', { status: query.status });
    }

    if (query.tag) {
      queryBuilder.andWhere('room.tag = :tag', { tag: query.tag });
    }

    if (query.ownerId) {
      queryBuilder.andWhere('room.ownerId = :ownerId', { ownerId: query.ownerId });
    }

    if (query.hasCapacity) {
      queryBuilder.andWhere(
        'room.currentCapacity < JSON_EXTRACT(room.configuration, "$.maxCapacity")',
      );
    }

    if (query.noPassword) {
      queryBuilder.andWhere('room.passwordHash IS NULL');
    }

    if (query.templateId) {
      queryBuilder.andWhere('room.templateId = :templateId', {
        templateId: query.templateId,
      });
    }

    // Apply sorting
    const sortField = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'DESC';
    queryBuilder.orderBy(`room.${sortField}`, sortOrder);

    // Apply pagination
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    queryBuilder.skip(skip).take(limit);

    const [rooms, total] = await queryBuilder.getManyAndCount();

    return {
      rooms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRoomById(roomId: string): Promise<GameRoomEntity> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
      relations: ['members', 'activities'],
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }

  async deleteRoom(roomId: string, userId: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const room = await queryRunner.manager.findOne(GameRoomEntity, {
        where: { id: roomId },
      });

      if (!room) {
        throw new NotFoundException('Room not found');
      }

      if (!room.isOwner(userId)) {
        throw new ForbiddenException('Only room owner can delete the room');
      }

      // Archive room instead of hard delete
      room.isArchived = true;
      room.archivedAt = new Date();
      room.status = RoomStatus.INACTIVE;

      await queryRunner.manager.save(room);

      // Log deletion activity
      const activity = queryRunner.manager.create(RoomActivityEntity, {
        roomId,
        eventType: 'room_deleted',
        userId,
        username: room.ownerUsername,
        metadata: {},
      });

      await queryRunner.manager.save(activity);

      await queryRunner.commitTransaction();

      this.logger.log(`Room ${roomId} deleted by user ${userId}`);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async handleOwnerLeaving(room: GameRoomEntity, manager: any): Promise<void> {
    // Find next highest role member to transfer ownership
    const nextOwner = await manager.findOne(RoomMemberEntity, {
      where: { roomId: room.id, role: RoomRole.MODERATOR },
      order: { joinedAt: 'ASC' },
    });

    if (nextOwner) {
      // Transfer ownership
      nextOwner.role = RoomRole.OWNER;
      nextOwner.permissions = ['*'];
      await manager.save(nextOwner);

      room.ownerId = nextOwner.userId;
      room.ownerUsername = nextOwner.username;
      await manager.save(room);
    } else {
      // No suitable replacement, archive the room
      room.isArchived = true;
      room.archivedAt = new Date();
      room.status = RoomStatus.INACTIVE;
      await manager.save(room);
    }
  }

  private async updateRoomAnalytics(
    roomId: string,
    eventType: string,
    manager: any,
  ): Promise<void> {
    const room = await manager.findOne(GameRoomEntity, { where: { id: roomId } });
    if (!room) return;

    const analytics = room.analytics || ({} as RoomAnalytics);

    switch (eventType) {
      case 'member_joined':
        analytics.totalMembers = (analytics.totalMembers || 0) + 1;
        analytics.activeMembers = room.currentCapacity;
        analytics.peakConcurrency = Math.max(analytics.peakConcurrency || 0, room.currentCapacity);
        break;
      case 'member_left':
        analytics.activeMembers = room.currentCapacity - 1;
        break;
    }

    analytics.lastActivity = new Date();
    room.analytics = analytics;
    room.lastActivityAt = new Date();

    await manager.save(room);
  }

  private async scheduleRoomCleanup(roomId: string): Promise<void> {
    // Schedule cleanup job for inactive rooms
    await this.roomCleanupQueue.add(
      'check-room-activity',
      { roomId },
      {
        delay: 24 * 60 * 60 * 1000, // 24 hours
        repeat: { every: 6 * 60 * 60 * 1000 }, // Every 6 hours
      },
    );
  }
}
