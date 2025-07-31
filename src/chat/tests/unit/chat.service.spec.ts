import { Test, type TestingModule } from "@nestjs/testing";
import { getModelToken } from "@nestjs/mongoose";
import { ChatService } from "../../services/chat.service";
import { ChatMessage } from "../../entities/chat-message.entity";
import { ChatRoom } from "../../entities/chat-room.entity";
import { ElasticsearchService } from "@nestjs/elasticsearch";
import { RedisService } from "../../../../common/services/redis.service";
import { EncryptionService } from "../../../../common/services/encryption.service";
import { jest } from "@jest/globals";

describe("ChatService", () => {
  let service: ChatService;
  let messageModel: any;
  let roomModel: any;

  const mockMessageModel = {
    find: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    populate: jest.fn(),
  };

  const mockRoomModel = {
    findById: jest.fn(),
  };

  const mockElasticsearchService = {
    index: jest.fn(),
    search: jest.fn(),
    update: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    setex: jest.fn(),
    lpush: jest.fn(),
    ltrim: jest.fn(),
    expire: jest.fn(),
  };

  const mockEncryptionService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getModelToken(ChatMessage.name),
          useValue: mockMessageModel,
        },
        {
          provide: getModelToken(ChatRoom.name),
          useValue: mockRoomModel,
        },
        {
          provide: ElasticsearchService,
          useValue: mockElasticsearchService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
    messageModel = module.get(getModelToken(ChatMessage.name));
    roomModel = module.get(getModelToken(ChatRoom.name));
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("createMessage", () => {
    it("should create a message successfully", async () => {
      const createMessageDto = {
        content: "Hello World",
        roomId: "507f1f77bcf86cd799439011",
        type: "text",
      };
      const senderId = "507f1f77bcf86cd799439012";

      const mockRoom = {
        _id: "507f1f77bcf86cd799439011",
        type: "public",
        participants: [],
      };

      const mockMessage = {
        _id: "507f1f77bcf86cd799439013",
        ...createMessageDto,
        senderId,
        save: jest.fn().mockResolvedValue({
          ...createMessageDto,
          senderId,
          populate: jest.fn().mockResolvedValue({
            ...createMessageDto,
            senderId,
          }),
        }),
      };

      roomModel.findById.mockResolvedValue(mockRoom);
      messageModel.mockImplementation(() => mockMessage);

      const result = await service.createMessage(createMessageDto, senderId);

      expect(roomModel.findById).toHaveBeenCalledWith(createMessageDto.roomId);
      expect(mockMessage.save).toHaveBeenCalled();
    });
  });
});
