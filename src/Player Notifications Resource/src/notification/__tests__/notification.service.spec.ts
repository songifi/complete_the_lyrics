import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import { getQueueToken } from "@nestjs/bull"
import type { Repository } from "typeorm"
import type { Queue } from "bull"
import { NotificationService } from "../services/notification.service"
import { Notification } from "../entities/notification.entity"
import { NotificationPreference } from "../entities/notification-preference.entity"
import { NotificationAnalytics } from "../entities/notification-analytics.entity"
import { EmailService } from "../services/email.service"
import { PushNotificationService } from "../services/push-notification.service"
import { NotificationGateway } from "../gateways/notification.gateway"
import { CacheService } from "../services/cache.service"
import { NotificationType, NotificationCategory, NotificationStatus } from "../enums/notification-type.enum"
import { jest } from "@jest/globals" // Import jest to fix the undeclared variable error

describe("NotificationService", () => {
  let service: NotificationService
  let notificationRepository: Repository<Notification>
  let preferenceRepository: Repository<NotificationPreference>
  let analyticsRepository: Repository<NotificationAnalytics>
  let notificationQueue: Queue
  let emailService: EmailService
  let pushNotificationService: PushNotificationService
  let notificationGateway: NotificationGateway
  let cacheService: CacheService

  const mockNotificationRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  }

  const mockPreferenceRepository = {
    findOne: jest.fn(),
  }

  const mockAnalyticsRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  }

  const mockQueue = {
    add: jest.fn(),
  }

  const mockEmailService = {
    sendNotification: jest.fn(),
  }

  const mockPushNotificationService = {
    sendNotification: jest.fn(),
  }

  const mockNotificationGateway = {
    sendToUser: jest.fn(),
  }

  const mockCacheService = {
    get: jest.fn(),
    set: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(Notification),
          useValue: mockNotificationRepository,
        },
        {
          provide: getRepositoryToken(NotificationPreference),
          useValue: mockPreferenceRepository,
        },
        {
          provide: getRepositoryToken(NotificationAnalytics),
          useValue: mockAnalyticsRepository,
        },
        {
          provide: getQueueToken("notification"),
          useValue: mockQueue,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: PushNotificationService,
          useValue: mockPushNotificationService,
        },
        {
          provide: NotificationGateway,
          useValue: mockNotificationGateway,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile()

    service = module.get<NotificationService>(NotificationService)
    notificationRepository = module.get<Repository<Notification>>(getRepositoryToken(Notification))
    preferenceRepository = module.get<Repository<NotificationPreference>>(getRepositoryToken(NotificationPreference))
    analyticsRepository = module.get<Repository<NotificationAnalytics>>(getRepositoryToken(NotificationAnalytics))
    notificationQueue = module.get<Queue>(getQueueToken("notification"))
    emailService = module.get<EmailService>(EmailService)
    pushNotificationService = module.get<PushNotificationService>(PushNotificationService)
    notificationGateway = module.get<NotificationGateway>(NotificationGateway)
    cacheService = module.get<CacheService>(CacheService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("create", () => {
    it("should create and send a notification immediately", async () => {
      const createDto = {
        userId: "user-1",
        type: NotificationType.EMAIL,
        category: NotificationCategory.TRANSACTIONAL,
        title: "Test Notification",
        content: "Test content",
      }

      const mockNotification = {
        id: "notification-1",
        ...createDto,
        status: NotificationStatus.PENDING,
        scheduledAt: null,
      }

      mockCacheService.get.mockResolvedValue(null)
      mockPreferenceRepository.findOne.mockResolvedValue(null)
      mockCacheService.set.mockResolvedValue(undefined)
      mockNotificationRepository.create.mockReturnValue(mockNotification)
      mockNotificationRepository.save.mockResolvedValue(mockNotification)
      mockNotificationRepository.findOne.mockResolvedValue(mockNotification)
      mockEmailService.sendNotification.mockResolvedValue(undefined)
      mockNotificationRepository.update.mockResolvedValue(undefined)
      mockAnalyticsRepository.findOne.mockResolvedValue(null)
      mockAnalyticsRepository.create.mockReturnValue({})
      mockAnalyticsRepository.save.mockResolvedValue(undefined)

      const result = await service.create(createDto)

      expect(result).toEqual(mockNotification)
      expect(mockNotificationRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockNotificationRepository.save).toHaveBeenCalledWith(mockNotification)
      expect(mockEmailService.sendNotification).toHaveBeenCalledWith(mockNotification)
    })

    it("should schedule a notification for future delivery", async () => {
      const futureDate = new Date(Date.now() + 3600000) // 1 hour from now
      const createDto = {
        userId: "user-1",
        type: NotificationType.EMAIL,
        category: NotificationCategory.TRANSACTIONAL,
        title: "Scheduled Notification",
        content: "Scheduled content",
        scheduledAt: futureDate,
      }

      const mockNotification = {
        id: "notification-1",
        ...createDto,
        status: NotificationStatus.PENDING,
      }

      mockCacheService.get.mockResolvedValue(null)
      mockPreferenceRepository.findOne.mockResolvedValue(null)
      mockCacheService.set.mockResolvedValue(undefined)
      mockNotificationRepository.create.mockReturnValue(mockNotification)
      mockNotificationRepository.save.mockResolvedValue(mockNotification)
      mockQueue.add.mockResolvedValue(undefined)

      const result = await service.create(createDto)

      expect(result).toEqual(mockNotification)
      expect(mockQueue.add).toHaveBeenCalledWith(
        "send-notification",
        { notificationId: mockNotification.id },
        { delay: expect.any(Number) },
      )
    })

    it("should not create notification if user preferences block it", async () => {
      const createDto = {
        userId: "user-1",
        type: NotificationType.EMAIL,
        category: NotificationCategory.MARKETING,
        title: "Marketing Notification",
        content: "Marketing content",
      }

      mockCacheService.get.mockResolvedValue("false")

      const result = await service.create(createDto)

      expect(result).toBeNull()
      expect(mockNotificationRepository.create).not.toHaveBeenCalled()
    })
  })

  describe("sendNotification", () => {
    it("should send email notification successfully", async () => {
      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        type: NotificationType.EMAIL,
        category: NotificationCategory.TRANSACTIONAL,
        title: "Test Email",
        content: "Test content",
        status: NotificationStatus.PENDING,
      }

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification)
      mockEmailService.sendNotification.mockResolvedValue(undefined)
      mockNotificationRepository.update.mockResolvedValue(undefined)
      mockAnalyticsRepository.findOne.mockResolvedValue(null)
      mockAnalyticsRepository.create.mockReturnValue({})
      mockAnalyticsRepository.save.mockResolvedValue(undefined)

      await service.sendNotification("notification-1")

      expect(mockEmailService.sendNotification).toHaveBeenCalledWith(mockNotification)
      expect(mockNotificationRepository.update).toHaveBeenCalledWith("notification-1", {
        status: NotificationStatus.SENT,
        sentAt: expect.any(Date),
      })
    })

    it("should send push notification successfully", async () => {
      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        type: NotificationType.PUSH,
        category: NotificationCategory.TRANSACTIONAL,
        title: "Test Push",
        content: "Test content",
        status: NotificationStatus.PENDING,
      }

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification)
      mockPushNotificationService.sendNotification.mockResolvedValue(undefined)
      mockNotificationRepository.update.mockResolvedValue(undefined)
      mockAnalyticsRepository.findOne.mockResolvedValue(null)
      mockAnalyticsRepository.create.mockReturnValue({})
      mockAnalyticsRepository.save.mockResolvedValue(undefined)

      await service.sendNotification("notification-1")

      expect(mockPushNotificationService.sendNotification).toHaveBeenCalledWith(mockNotification)
    })

    it("should send in-app notification successfully", async () => {
      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        type: NotificationType.IN_APP,
        category: NotificationCategory.TRANSACTIONAL,
        title: "Test In-App",
        content: "Test content",
        status: NotificationStatus.PENDING,
      }

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification)
      mockNotificationGateway.sendToUser.mockResolvedValue(undefined)
      mockNotificationRepository.update.mockResolvedValue(undefined)
      mockAnalyticsRepository.findOne.mockResolvedValue(null)
      mockAnalyticsRepository.create.mockReturnValue({})
      mockAnalyticsRepository.save.mockResolvedValue(undefined)

      await service.sendNotification("notification-1")

      expect(mockNotificationGateway.sendToUser).toHaveBeenCalledWith("user-1", mockNotification)
    })

    it("should handle notification failure and retry", async () => {
      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        type: NotificationType.EMAIL,
        category: NotificationCategory.TRANSACTIONAL,
        title: "Test Email",
        content: "Test content",
        status: NotificationStatus.PENDING,
        retryCount: 0,
        maxRetries: 3,
      }

      mockNotificationRepository.findOne.mockResolvedValue(mockNotification)
      mockEmailService.sendNotification.mockRejectedValue(new Error("SMTP Error"))
      mockNotificationRepository.update.mockResolvedValue(undefined)
      mockQueue.add.mockResolvedValue(undefined)

      await service.sendNotification("notification-1")

      expect(mockNotificationRepository.update).toHaveBeenCalledWith("notification-1", {
        retryCount: 1,
        failureReason: "SMTP Error",
      })
      expect(mockQueue.add).toHaveBeenCalledWith(
        "send-notification",
        { notificationId: "notification-1" },
        { delay: expect.any(Number) },
      )
    })
  })

  describe("markAsRead", () => {
    it("should mark notification as read and update analytics", async () => {
      const mockNotification = {
        id: "notification-1",
        userId: "user-1",
        type: NotificationType.EMAIL,
        category: NotificationCategory.TRANSACTIONAL,
      }

      mockNotificationRepository.update.mockResolvedValue(undefined)
      mockNotificationRepository.findOne.mockResolvedValue(mockNotification)
      mockAnalyticsRepository.findOne.mockResolvedValue(null)
      mockAnalyticsRepository.create.mockReturnValue({})
      mockAnalyticsRepository.save.mockResolvedValue(undefined)

      await service.markAsRead("notification-1")

      expect(mockNotificationRepository.update).toHaveBeenCalledWith("notification-1", {
        status: NotificationStatus.READ,
        readAt: expect.any(Date),
      })
    })
  })

  describe("getUserNotifications", () => {
    it("should return paginated user notifications", async () => {
      const mockNotifications = [
        { id: "notification-1", userId: "user-1" },
        { id: "notification-2", userId: "user-1" },
      ]

      mockNotificationRepository.findAndCount.mockResolvedValue([mockNotifications, 2])

      const result = await service.getUserNotifications("user-1", 1, 20)

      expect(result).toEqual({
        notifications: mockNotifications,
        total: 2,
      })
      expect(mockNotificationRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        order: { createdAt: "DESC" },
        skip: 0,
        take: 20,
      })
    })
  })

  describe("getUnreadCount", () => {
    it("should return unread notification count", async () => {
      mockNotificationRepository.count.mockResolvedValue(5)

      const result = await service.getUnreadCount("user-1")

      expect(result).toBe(5)
      expect(mockNotificationRepository.count).toHaveBeenCalledWith({
        where: {
          userId: "user-1",
          status: NotificationStatus.SENT,
        },
      })
    })
  })
})
