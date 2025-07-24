import { Injectable } from "@nestjs/common"
import type { Repository } from "typeorm"
import type { NotificationPreference } from "../entities/notification-preference.entity"
import type {
  CreateNotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
} from "../dto/notification-preference.dto"
import type { CacheService } from "./cache.service"

@Injectable()
export class NotificationPreferenceService {
  private preferenceRepository: Repository<NotificationPreference>
  private cacheService: CacheService

  constructor(preferenceRepository: Repository<NotificationPreference>, cacheService: CacheService) {
    this.preferenceRepository = preferenceRepository
    this.cacheService = cacheService
  }

  async create(createDto: CreateNotificationPreferenceDto): Promise<NotificationPreference> {
    const preference = this.preferenceRepository.create(createDto)
    const saved = await this.preferenceRepository.save(preference)

    // Clear cache
    await this.clearUserPreferenceCache(createDto.userId)

    return saved
  }

  async findByUser(userId: string): Promise<NotificationPreference[]> {
    return this.preferenceRepository.find({
      where: { userId },
      order: { type: "ASC", category: "ASC" },
    })
  }

  async update(id: string, updateDto: UpdateNotificationPreferenceDto): Promise<NotificationPreference> {
    await this.preferenceRepository.update(id, updateDto)
    const updated = await this.preferenceRepository.findOne({ where: { id } })

    // Clear cache
    if (updated) {
      await this.clearUserPreferenceCache(updated.userId)
    }

    return updated
  }

  async delete(id: string): Promise<void> {
    const preference = await this.preferenceRepository.findOne({ where: { id } })
    if (preference) {
      await this.preferenceRepository.delete(id)
      await this.clearUserPreferenceCache(preference.userId)
    }
  }

  private async clearUserPreferenceCache(userId: string): Promise<void> {
    // Clear all preference cache entries for the user
    const pattern = `preferences:${userId}:*`
    // Note: In a real implementation, you'd need to scan and delete matching keys
    // This is a simplified version
  }
}
