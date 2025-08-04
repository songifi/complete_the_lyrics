import { Test, type TestingModule } from "@nestjs/testing"
import type { INestApplication } from "@nestjs/common"
import { type Socket, io } from "socket.io-client"
import { ChatGateway } from "../../gateways/chat.gateway"
import { ChatService } from "../../services/chat.service"
import { RateLimiterService } from "../../services/rate-limiter.service"
import { jest } from "@jest/globals"

describe("ChatGateway (Integration)", () => {
  let app: INestApplication
  let gateway: ChatGateway
  let clientSocket: Socket

  const mockChatService = {
    createMessage: jest.fn(),
    addReaction: jest.fn(),
  }

  const mockRateLimiterService = {
    checkRateLimit: jest.fn().mockResolvedValue(true),
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        {
          provide: ChatService,
          useValue: mockChatService,
        },
        {
          provide: RateLimiterService,
          useValue: mockRateLimiterService,
        },
      ],
    }).compile()

    app = moduleFixture.createNestApplication()
    gateway = moduleFixture.get<ChatGateway>(ChatGateway)

    await app.listen(3001)
  })

  beforeEach((done) => {
    clientSocket = io("http://localhost:3001/chat", {
      auth: {
        token: "test-token",
      },
    })
    clientSocket.on("connect", done)
  })

  afterEach(() => {
    clientSocket.close()
  })

  afterAll(async () => {
    await app.close()
  })

  it("should handle send_message event", (done) => {
    const messageData = {
      content: "Test message",
      roomId: "507f1f77bcf86cd799439011",
      type: "text",
    }

    const mockMessage = {
      _id: "507f1f77bcf86cd799439013",
      ...messageData,
      senderId: "user123",
      createdAt: new Date(),
    }

    mockChatService.createMessage.mockResolvedValue(mockMessage)

    clientSocket.emit("send_message", messageData)

    clientSocket.on("new_message", (data) => {
      expect(data).toEqual(mockMessage)
      done()
    })
  })

  it("should handle rate limiting", (done) => {
    mockRateLimiterService.checkRateLimit.mockResolvedValue(false)

    const messageData = {
      content: "Test message",
      roomId: "507f1f77bcf86cd799439011",
      type: "text",
    }

    clientSocket.emit("send_message", messageData)

    clientSocket.on("rate_limit_exceeded", (data) => {
      expect(data.message).toContain("Too many messages")
      done()
    })
  })
})
