import { Controller, Get, Post, Patch, Param, Delete, Query, UseGuards, UseInterceptors } from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse } from "@nestjs/swagger"
import type { NotificationService } from "../services/notification.service"
import type { NotificationPreferenceService } from "../services/notification-preference.service"
import type { CreateNotificationDto } from "../dto/create-notification.dto"
import type {
  CreateNotificationPreferenceDto,
  UpdateNotificationPreferenceDto,
} from "../dto/notification-preference.dto"
import { NotificationTrigger } from "../decorators/notification-trigger.decorator"
import { NotificationLoggingInterceptor } from "../interceptors/notification-logging.interceptor"
import { NotificationType, NotificationCategory } from "../enums/notification-type.enum"
import { ThrottlerGuard } from "@nestjs/throttler"

@ApiTags("notifications")
@Controller("notifications")
@UseGuards(ThrottlerGuard)
@UseInterceptors(NotificationLoggingInterceptor)
export class NotificationController {
  constructor(
    private readonly notificationService: NotificationService,
    private readonly preferenceService: NotificationPreferenceService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new notification" })
  @ApiResponse({ status: 201, description: "Notification created successfully" })
  @NotificationTrigger({
    type: NotificationType.IN_APP,
    category: NotificationCategory.SYSTEM,
    template: "notification-created",
  })
  async create(createNotificationDto: CreateNotificationDto) {
    return this.notificationService.create(createNotificationDto)
  }

  @Get("user/:userId")
  @ApiOperation({ summary: "Get user notifications" })
  async getUserNotifications(
    @Param('userId') userId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.notificationService.getUserNotifications(userId, page, limit)
  }

  @Get('user/:userId/unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  async getUnreadCount(@Param('userId') userId: string) {
    const count = await this.notificationService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Param('id') id: string) {
    await this.notificationService.markAsRead(id);
    return { message: 'Notification marked as read' };
  }

  @Get("analytics")
  @ApiOperation({ summary: "Get notification analytics" })
  async getAnalytics(
    @Query('userId') userId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const start = startDate ? new Date(startDate) : undefined
    const end = endDate ? new Date(endDate) : undefined

    return this.notificationService.getAnalytics(userId, start, end)
  }

  // Preference endpoints
  @Post("preferences")
  @ApiOperation({ summary: "Create notification preference" })
  async createPreference(createDto: CreateNotificationPreferenceDto) {
    return this.preferenceService.create(createDto)
  }

  @Get('preferences/user/:userId')
  @ApiOperation({ summary: 'Get user notification preferences' })
  async getUserPreferences(@Param('userId') userId: string) {
    return this.preferenceService.findByUser(userId);
  }

  @Patch("preferences/:id")
  @ApiOperation({ summary: "Update notification preference" })
  async updatePreference(@Param('id') id: string, updateDto: UpdateNotificationPreferenceDto) {
    return this.preferenceService.update(id, updateDto)
  }

  @Delete('preferences/:id')
  @ApiOperation({ summary: 'Delete notification preference' })
  async deletePreference(@Param('id') id: string) {
    await this.preferenceService.delete(id);
    return { message: 'Preference deleted successfully' };
  }
}
