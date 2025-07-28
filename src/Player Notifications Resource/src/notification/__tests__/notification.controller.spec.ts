import { Test, type TestingModule } from "@nestjs/testing"
import { ThrottlerGuard } from "@nestjs/throttler"
import { NotificationController } from "../controllers/notification.controller"
import { NotificationService } from "../services/notification.service"
import { NotificationPreferenceService } from "../services/notification-preference.service"
import { NotificationType, NotificationCategory } from "../enums/notification-type.enum"
import { jest } from "@jest/globals"

describe("NotificationController", () => {
  let controller: NotificationController
  let notificationService: NotificationService
  let preferenceService: NotificationPreferenceService

  const mockNotificationService = {
    create: jest.fn(),
    getUserNotifications: jest.fn(),
    getUnreadCount: jest.fn(),
    markAsRead: jest.fn(),
    getAnalytics: jest.fn(),
  }

  const mockPreferenceService = {
    create: jest.fn(),
    findByUser: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationController],
      providers: [
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: NotificationPreferenceService,
          useValue: mockPreferenceService,
        },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile()

    controller = module.get<NotificationController>(NotificationController)
    notificationService = module.get<NotificationService>(NotificationService)
    preferenceService = module.get<NotificationPreferenceService>(NotificationPreferenceService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create a notification", async () => {
      const createDto = {
        userId: "user-1",
        type: NotificationType.EMAIL,
        category: NotificationCategory.TRANSACTIONAL,
        title: "Test Notification",
        content: "Test content",
      }

      const mockNotification = { id: "notification-1", ...createDto }
      mockNotificationService.create.mockResolvedValue(mockNotification)

      const result = await controller.create(createDto)

      expect(result).toEqual(mockNotification)
      expect(mockNotificationService.create).toHaveBeenCalledWith(createDto)
    })
  })

  describe("getUserNotifications", () => {
    it("should return user notifications", async () => {
      const mockResult = {
        notifications: [{ id: "notification-1" }],
        total: 1,
      }

      mockNotificationService.getUserNotifications.mockResolvedValue(mockResult)

      const result = await controller.getUserNotifications("user-1", 1, 20)

      expect(result).toEqual(mockResult)
      expect(mockNotificationService.getUserNotifications).toHaveBeenCalledWith("user-1", 1, 20)
    })
  })

  describe("getUnreadCount", () => {
    it("should return unread count", async () => {
      mockNotificationService.getUnreadCount.mockResolvedValue(5)

      const result = await controller.getUnreadCount("user-1")

      expect(result).toEqual({ count: 5 })
      expect(mockNotificationService.getUnreadCount).toHaveBeenCalledWith("user-1")
    })
  })

  describe("markAsRead", () => {
    it("should mark notification as read", async () => {
      mockNotificationService.markAsRead.mockResolvedValue(undefined)

      const result = await controller.markAsRead("notification-1")

      expect(result).toEqual({ message: "Notification marked as read" })
      expect(mockNotificationService.markAsRead).toHaveBeenCalledWith("notification-1")
    })
  })

  describe("getAnalytics", () => {
    it("should return notification analytics", async () => {
      const mockAnalytics = [{ date: new Date(), sent: 10, delivered: 8, opened: 5 }]

      mockNotificationService.getAnalytics.mockResolvedValue(mockAnalytics)

      const result = await controller.getAnalytics("user-1", "2023-01-01", "2023-01-31")

      expect(result).toEqual(mockAnalytics)
      expect(mockNotificationService.getAnalytics).toHaveBeenCalledWith(
        "user-1",
        new Date("2023-01-01"),
        new Date("2023-01-31"),
      )
    })
  })

  describe("createPreference", () => {
    it("should create notification preference", async () => {
      const createDto = {
        userId: "user-1",
        type: NotificationType.EMAIL,
        category: NotificationCategory.MARKETING,
        enabled: false,
      }

      const mockPreference = { id: "preference-1", ...createDto }
      mockPreferenceService.create.mockResolvedValue(mockPreference)

      const result = await controller.createPreference(createDto)

      expect(result).toEqual(mockPreference)
      expect(mockPreferenceService.create).toHaveBeenCalledWith(createDto)
    })
  })

  describe("getUserPreferences", () => {
    it("should return user preferences", async () => {
      const mockPreferences = [{ id: "preference-1", userId: "user-1", enabled: true }]

      mockPreferenceService.findByUser.mockResolvedValue(mockPreferences)

      const result = await controller.getUserPreferences("user-1")

      expect(result).toEqual(mockPreferences)
      expect(mockPreferenceService.findByUser).toHaveBeenCalledWith("user-1")
    })
  })
})
