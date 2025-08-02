import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { GameRoomEntity, RoomMemberEntity } from '../entities';
import { RoomRole } from '../enums';
import { RedisPubSubService } from './redis-pubsub.service';
import { AuthenticatedUser } from '../interfaces';

export interface QueueEntry {
  userId: string;
  username: string;
  joinedAt: Date;
  priority: number;
  metadata?: Record<string, any>;
}

export interface QueuePosition {
  position: number;
  estimatedWaitTime: number; // in seconds
  queueLength: number;
}

@Injectable()
export class RoomQueueService {
  private readonly logger = new Logger(RoomQueueService.name);
  private roomQueues = new Map<string, QueueEntry[]>();
  private readonly maxQueueSize: number;
  private readonly maxWaitTime: number; // in milliseconds

  constructor(
    @InjectRepository(GameRoomEntity)
    private readonly roomRepository: Repository<GameRoomEntity>,
    @InjectRepository(RoomMemberEntity)
    private readonly memberRepository: Repository<RoomMemberEntity>,
    private readonly pubSubService: RedisPubSubService,
    private readonly configService: ConfigService,
  ) {
    this.maxQueueSize = this.configService.get('ROOM_QUEUE_MAX_SIZE', 50);
    this.maxWaitTime = this.configService.get('ROOM_QUEUE_MAX_WAIT_TIME', 300000); // 5 minutes

    // Start queue cleanup job
    this.startQueueCleanup();
  }

  /**
   * Add a user to the room queue
   */
  async addToQueue(
    roomId: string,
    user: AuthenticatedUser,
    priority: number = 0,
    metadata?: Record<string, any>,
  ): Promise<QueuePosition> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    if (!room.isFull()) {
      throw new Error('Room is not full, user can join directly');
    }

    // Initialize queue for room if it doesn't exist
    if (!this.roomQueues.has(roomId)) {
      this.roomQueues.set(roomId, []);
    }

    const queue = this.roomQueues.get(roomId)!;

    // Check if user is already in queue
    const existingIndex = queue.findIndex((entry) => entry.userId === user.id);
    if (existingIndex !== -1) {
      return this.getQueuePosition(roomId, user.id);
    }

    // Check queue size limit
    if (queue.length >= this.maxQueueSize) {
      throw new Error('Queue is full');
    }

    // Create queue entry
    const queueEntry: QueueEntry = {
      userId: user.id,
      username: user.username,
      joinedAt: new Date(),
      priority,
      metadata,
    };

    // Insert based on priority (higher priority first)
    let insertIndex = queue.length;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].priority < priority) {
        insertIndex = i;
        break;
      }
    }

    queue.splice(insertIndex, 0, queueEntry);

    // Notify queue update
    await this.notifyQueueUpdate(roomId);

    this.logger.log(
      `User ${user.username} added to queue for room ${roomId} at position ${insertIndex + 1}`,
    );

    return this.getQueuePosition(roomId, user.id);
  }

  /**
   * Remove a user from the room queue
   */
  async removeFromQueue(roomId: string, userId: string): Promise<boolean> {
    const queue = this.roomQueues.get(roomId);
    if (!queue) {
      return false;
    }

    const index = queue.findIndex((entry) => entry.userId === userId);
    if (index === -1) {
      return false;
    }

    const removedEntry = queue.splice(index, 1)[0];

    // Clean up empty queues
    if (queue.length === 0) {
      this.roomQueues.delete(roomId);
    } else {
      await this.notifyQueueUpdate(roomId);
    }

    this.logger.log(`User ${removedEntry.username} removed from queue for room ${roomId}`);
    return true;
  }

  /**
   * Get the next user from the queue and attempt to add them to the room
   */
  async processQueue(roomId: string): Promise<boolean> {
    const room = await this.roomRepository.findOne({
      where: { id: roomId },
    });

    if (!room || room.isFull()) {
      return false;
    }

    const queue = this.roomQueues.get(roomId);
    if (!queue || queue.length === 0) {
      return false;
    }

    // Get the next user in queue
    const nextEntry = queue.shift()!;

    try {
      // Attempt to add user to room
      const member = this.memberRepository.create({
        roomId: room.id,
        userId: nextEntry.userId,
        username: nextEntry.username,
        role: RoomRole.MEMBER,
        lastActivityAt: new Date(),
      });

      await this.memberRepository.save(member);

      // Update room capacity
      room.currentCapacity += 1;
      await this.roomRepository.save(room);

      // Notify user that they can join
      await this.pubSubService.publishRoomEvent(roomId, {
        type: 'queue-processed',
        roomId,
        userId: nextEntry.userId,
        username: nextEntry.username,
        data: {
          message: 'You can now join the room',
          autoJoin: true,
        },
        timestamp: new Date(),
      });

      // Notify queue update
      await this.notifyQueueUpdate(roomId);

      this.logger.log(
        `User ${nextEntry.username} processed from queue and added to room ${roomId}`,
      );
      return true;
    } catch (error) {
      // If adding to room fails, put user back at front of queue
      queue.unshift(nextEntry);
      this.logger.error(`Failed to process queue for room ${roomId}:`, error);
      return false;
    }
  }

  /**
   * Get user's position in queue
   */
  getQueuePosition(roomId: string, userId: string): QueuePosition {
    const queue = this.roomQueues.get(roomId);
    if (!queue) {
      throw new Error('Queue not found');
    }

    const position = queue.findIndex((entry) => entry.userId === userId);
    if (position === -1) {
      throw new Error('User not in queue');
    }

    const estimatedWaitTime = this.calculateEstimatedWaitTime(queue, position);

    return {
      position: position + 1, // 1-based position
      estimatedWaitTime,
      queueLength: queue.length,
    };
  }

  /**
   * Get queue status for a room
   */
  getQueueStatus(roomId: string) {
    const queue = this.roomQueues.get(roomId);
    if (!queue) {
      return {
        length: 0,
        maxSize: this.maxQueueSize,
        entries: [],
      };
    }

    return {
      length: queue.length,
      maxSize: this.maxQueueSize,
      entries: queue.map((entry, index) => ({
        position: index + 1,
        username: entry.username,
        priority: entry.priority,
        waitTime: Date.now() - entry.joinedAt.getTime(),
      })),
    };
  }

  /**
   * Get all queues (for admin purposes)
   */
  getAllQueues() {
    const result = new Map<string, any>();

    for (const [roomId, queue] of this.roomQueues.entries()) {
      result.set(roomId, {
        length: queue.length,
        entries: queue.map((entry, index) => ({
          position: index + 1,
          userId: entry.userId,
          username: entry.username,
          priority: entry.priority,
          joinedAt: entry.joinedAt,
          waitTime: Date.now() - entry.joinedAt.getTime(),
        })),
      });
    }

    return result;
  }

  /**
   * Clear queue for a room
   */
  async clearQueue(roomId: string): Promise<boolean> {
    const queue = this.roomQueues.get(roomId);
    if (!queue) {
      return false;
    }

    // Notify all users in queue that it's been cleared
    for (const entry of queue) {
      await this.pubSubService.publishRoomEvent(roomId, {
        type: 'queue-cleared',
        roomId,
        userId: entry.userId,
        username: entry.username,
        data: {
          message: 'Queue has been cleared',
        },
        timestamp: new Date(),
      });
    }

    this.roomQueues.delete(roomId);
    this.logger.log(`Queue cleared for room ${roomId}`);
    return true;
  }

  /**
   * Update user priority in queue
   */
  async updatePriority(roomId: string, userId: string, newPriority: number): Promise<boolean> {
    const queue = this.roomQueues.get(roomId);
    if (!queue) {
      return false;
    }

    const entryIndex = queue.findIndex((entry) => entry.userId === userId);
    if (entryIndex === -1) {
      return false;
    }

    // Remove entry and re-insert with new priority
    const entry = queue.splice(entryIndex, 1)[0];
    entry.priority = newPriority;

    // Find new position based on priority
    let insertIndex = queue.length;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].priority < newPriority) {
        insertIndex = i;
        break;
      }
    }

    queue.splice(insertIndex, 0, entry);

    await this.notifyQueueUpdate(roomId);
    this.logger.log(`Updated priority for user ${entry.username} in room ${roomId} queue`);
    return true;
  }

  private calculateEstimatedWaitTime(queue: QueueEntry[], position: number): number {
    // Simple estimation based on average processing time
    const avgProcessingTime = 30; // 30 seconds per user (configurable)
    return position * avgProcessingTime;
  }

  private async notifyQueueUpdate(roomId: string): Promise<void> {
    const queueStatus = this.getQueueStatus(roomId);

    await this.pubSubService.publishRoomEvent(roomId, {
      type: 'queue-updated',
      roomId,
      data: queueStatus,
      timestamp: new Date(),
    });
  }

  private startQueueCleanup(): void {
    // Clean up old queue entries every 5 minutes
    setInterval(
      () => {
        this.cleanupExpiredEntries();
      },
      5 * 60 * 1000,
    );
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();

    for (const [roomId, queue] of this.roomQueues.entries()) {
      const originalLength = queue.length;

      // Remove entries that have been waiting too long
      const validEntries = queue.filter((entry) => {
        const waitTime = now - entry.joinedAt.getTime();
        return waitTime < this.maxWaitTime;
      });

      if (validEntries.length !== originalLength) {
        this.roomQueues.set(roomId, validEntries);

        if (validEntries.length === 0) {
          this.roomQueues.delete(roomId);
        }

        this.logger.log(
          `Cleaned up ${originalLength - validEntries.length} expired entries from room ${roomId} queue`,
        );
      }
    }
  }
}
