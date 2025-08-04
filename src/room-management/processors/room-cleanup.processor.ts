import { Processor, Process, OnQueueActive, OnQueueCompleted, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Job } from 'bull';
import { GameRoomEntity, RoomMemberEntity, RoomActivityEntity } from '../entities';
import { RoomStatus } from '../enums';

@Processor('room-cleanup')
export class RoomCleanupProcessor {
  private readonly logger = new Logger(RoomCleanupProcessor.name);

  constructor(
    @InjectRepository(GameRoomEntity)
    private roomRepository: Repository<GameRoomEntity>,
    @InjectRepository(RoomMemberEntity)
    private roomMemberRepository: Repository<RoomMemberEntity>,
    @InjectRepository(RoomActivityEntity)
    private roomActivityRepository: Repository<RoomActivityEntity>,
  ) {}

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job) {
    this.logger.log(`Completed job ${job.id} of type ${job.name}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, err: Error) {
    this.logger.error(`Failed job ${job.id} of type ${job.name}: ${err.message}`);
  }

  @Process('check-room-activity')
  async checkRoomActivity(job: Job<{ roomId: string }>) {
    const { roomId } = job.data;

    try {
      const room = await this.roomRepository.findOne({
        where: { id: roomId },
        relations: ['members'],
      });

      if (!room) {
        this.logger.warn(`Room ${roomId} not found for activity check`);
        return;
      }

      // Check if room has been inactive for more than 24 hours
      const inactiveThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

      if (room.lastActivityAt && room.lastActivityAt < inactiveThreshold) {
        // Check if room is empty
        if (room.currentCapacity === 0) {
          await this.archiveEmptyRoom(room);
        } else {
          // Check for inactive members
          await this.removeInactiveMembers(room);
        }
      }

      // Update room analytics
      await this.updateRoomAnalytics(room);
    } catch (error) {
      this.logger.error(`Error checking room activity for ${roomId}:`, error);
      throw error;
    }
  }

  @Process('cleanup-old-activities')
  async cleanupOldActivities(job: Job<{ olderThanDays: number }>) {
    const { olderThanDays } = job.data;

    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      const result = await this.roomActivityRepository.delete({
        timestamp: LessThan(cutoffDate),
      });

      this.logger.log(`Cleaned up ${result.affected} old activity records`);
    } catch (error) {
      this.logger.error('Error cleaning up old activities:', error);
      throw error;
    }
  }

  @Process('cleanup-archived-rooms')
  async cleanupArchivedRooms(job: Job<{ olderThanDays: number }>) {
    const { olderThanDays } = job.data;

    try {
      const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

      // Find rooms archived longer than the threshold
      const archivedRooms = await this.roomRepository.find({
        where: {
          isArchived: true,
          archivedAt: LessThan(cutoffDate),
        },
      });

      for (const room of archivedRooms) {
        // Remove all members
        await this.roomMemberRepository.delete({ roomId: room.id });

        // Remove all activities
        await this.roomActivityRepository.delete({ roomId: room.id });

        // Remove the room
        await this.roomRepository.remove(room);
      }

      this.logger.log(`Permanently deleted ${archivedRooms.length} archived rooms`);
    } catch (error) {
      this.logger.error('Error cleaning up archived rooms:', error);
      throw error;
    }
  }

  @Process('update-room-analytics')
  async updateRoomAnalytics(job: Job<{ roomId?: string }>) {
    try {
      const whereClause = job.data.roomId
        ? { id: job.data.roomId, status: RoomStatus.ACTIVE }
        : { status: RoomStatus.ACTIVE };

      const rooms = await this.roomRepository.find({
        where: whereClause,
        relations: ['members'],
      });

      for (const room of rooms) {
        await this.updateRoomAnalytics(room);
      }

      this.logger.log(`Updated analytics for ${rooms.length} rooms`);
    } catch (error) {
      this.logger.error('Error updating room analytics:', error);
      throw error;
    }
  }

  @Process('check-member-activity')
  async checkMemberActivity(job: Job) {
    try {
      const inactiveThreshold = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours

      const inactiveMembers = await this.roomMemberRepository.find({
        where: {
          lastActivityAt: LessThan(inactiveThreshold),
        },
        relations: ['room'],
      });

      for (const member of inactiveMembers) {
        if (member.room && member.room.status === RoomStatus.ACTIVE) {
          // Log member as inactive but don't remove immediately
          await this.roomActivityRepository.save({
            roomId: member.roomId,
            eventType: 'member_inactive',
            userId: member.userId,
            username: member.username,
            metadata: {
              lastActivity: member.lastActivityAt,
              inactiveDuration: Date.now() - member.lastActivityAt.getTime(),
            },
          });
        }
      }

      this.logger.log(`Checked activity for ${inactiveMembers.length} inactive members`);
    } catch (error) {
      this.logger.error('Error checking member activity:', error);
      throw error;
    }
  }

  private async archiveEmptyRoom(room: GameRoomEntity): Promise<void> {
    room.isArchived = true;
    room.archivedAt = new Date();
    room.status = RoomStatus.INACTIVE;

    await this.roomRepository.save(room);

    // Log archival
    await this.roomActivityRepository.save({
      roomId: room.id,
      eventType: 'room_auto_archived',
      userId: 'system',
      username: 'System',
      metadata: {
        reason: 'Room was empty and inactive',
        lastActivity: room.lastActivityAt,
      },
    });

    this.logger.log(`Auto-archived empty room: ${room.id}`);
  }

  private async removeInactiveMembers(room: GameRoomEntity): Promise<void> {
    const inactiveThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours

    const inactiveMembers = await this.roomMemberRepository.find({
      where: {
        roomId: room.id,
        lastActivityAt: LessThan(inactiveThreshold),
      },
    });

    for (const member of inactiveMembers) {
      // Don't remove owners or moderators automatically
      if (member.role === 'owner' || member.role === 'moderator') {
        continue;
      }

      await this.roomMemberRepository.remove(member);

      // Update room capacity
      room.currentCapacity = Math.max(0, room.currentCapacity - 1);

      // Log removal
      await this.roomActivityRepository.save({
        roomId: room.id,
        eventType: 'member_auto_removed',
        userId: member.userId,
        username: member.username,
        metadata: {
          reason: 'Inactive for too long',
          lastActivity: member.lastActivityAt,
        },
      });
    }

    if (inactiveMembers.length > 0) {
      await this.roomRepository.save(room);
      this.logger.log(`Removed ${inactiveMembers.length} inactive members from room ${room.id}`);
    }
  }

  private async updateRoomAnalytics(room: GameRoomEntity): Promise<void> {
    const analytics = room.analytics || {
      totalMembers: 0,
      activeMembers: 0,
      peakConcurrency: 0,
      averageSessionDuration: 0,
      messageCount: 0,
      moderationActions: 0,
      createdAt: room.createdAt,
      lastActivity: new Date(),
    };

    // Update active members count
    analytics.activeMembers = room.currentCapacity;

    // Update peak concurrency if current is higher
    analytics.peakConcurrency = Math.max(analytics.peakConcurrency || 0, room.currentCapacity);

    // Calculate average session duration (simplified)
    const now = new Date();
    const roomAge = now.getTime() - room.createdAt.getTime();
    const estimatedSessions = analytics.totalMembers || 1;
    analytics.averageSessionDuration = roomAge / (estimatedSessions * 60 * 1000); // in minutes

    // Update last activity
    analytics.lastActivity = room.lastActivityAt || now;

    room.analytics = analytics;
    await this.roomRepository.save(room);
  }
}
