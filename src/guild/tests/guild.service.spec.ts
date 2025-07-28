import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { EventEmitter2 } from "@nestjs/event-emitter"
import { GuildService } from "../services/guild.service"
import { GuildCacheService } from "../services/guild-cache.service"
import { Guild, GuildStatus } from "../entities/guild.entity"
import { GuildMember, GuildRole, MemberStatus } from "../entities/guild-member.entity"
import { ConflictException, NotFoundException } from "@nestjs/common"
import { jest } from "@jest/globals" // Import jest to declare it

describe("GuildService", () => {
  let service: GuildService
  let guildRepository: Repository<Guild>
  let guildMemberRepository: Repository<GuildMember>
  let eventEmitter: EventEmitter2
  let cacheService: GuildCacheService

  const mockGuildRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
  }

  const mockGuildMemberRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    remove: jest.fn(),
  }

  const mockEventEmitter = {
    emit: jest.fn(),
  }

  const mockCacheService = {
    cacheGuild: jest.fn(),
    getGuild: jest.fn(),
    removeGuild: jest.fn(),
    invalidateGuild: jest.fn(),
    cacheGuildActivity: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GuildService,
        {
          provide: getRepositoryToken(Guild),
          useValue: mockGuildRepository,
        },
        {
          provide: getRepositoryToken(GuildMember),
          useValue: mockGuildMemberRepository,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: GuildCacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile()

    service = module.get<GuildService>(GuildService)
    guildRepository = module.get<Repository<Guild>>(getRepositoryToken(Guild))
    guildMemberRepository = module.get<Repository<GuildMember>>(getRepositoryToken(GuildMember))
    eventEmitter = module.get<EventEmitter2>(EventEmitter2)
    cacheService = module.get<GuildCacheService>(GuildCacheService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe("createGuild", () => {
    it("should create a guild successfully", async () => {
      const createGuildDto = {
        name: "Test Guild",
        description: "A test guild",
        maxMembers: 50,
      }
      const creatorUserId = "user-123"

      const mockGuild = {
        id: "guild-123",
        ...createGuildDto,
        status: GuildStatus.ACTIVE,
        level: 0,
        experience: 0,
      }

      const mockGuildMember = {
        id: "member-123",
        guildId: "guild-123",
        userId: creatorUserId,
        role: GuildRole.LEADER,
        status: MemberStatus.ACTIVE,
      }

      mockGuildRepository.findOne.mockResolvedValue(null)
      mockGuildRepository.create.mockReturnValue(mockGuild)
      mockGuildRepository.save.mockResolvedValue(mockGuild)
      mockGuildMemberRepository.create.mockReturnValue(mockGuildMember)
      mockGuildMemberRepository.save.mockResolvedValue(mockGuildMember)

      const result = await service.createGuild(createGuildDto, creatorUserId)

      expect(result).toEqual(mockGuild)
      expect(mockGuildRepository.findOne).toHaveBeenCalledWith({
        where: { name: createGuildDto.name },
      })
      expect(mockGuildRepository.create).toHaveBeenCalledWith(createGuildDto)
      expect(mockGuildRepository.save).toHaveBeenCalledWith(mockGuild)
      expect(mockEventEmitter.emit).toHaveBeenCalledWith("guild.created", {
        guild: mockGuild,
        creatorUserId,
      })
      expect(mockCacheService.cacheGuild).toHaveBeenCalledWith(mockGuild)
    })

    it("should throw ConflictException if guild name already exists", async () => {
      const createGuildDto = {
        name: "Existing Guild",
        description: "A test guild",
      }
      const creatorUserId = "user-123"

      const existingGuild = {
        id: "existing-guild-123",
        name: "Existing Guild",
      }

      mockGuildRepository.findOne.mockResolvedValue(existingGuild)

      await expect(service.createGuild(createGuildDto, creatorUserId)).rejects.toThrow(ConflictException)
    })
  })

  describe("findGuildById", () => {
    it("should return guild from cache if available", async () => {
      const guildId = "guild-123"
      const mockGuild = {
        id: guildId,
        name: "Test Guild",
        status: GuildStatus.ACTIVE,
      }

      mockCacheService.getGuild.mockResolvedValue(mockGuild)

      const result = await service.findGuildById(guildId)

      expect(result).toEqual(mockGuild)
      expect(mockCacheService.getGuild).toHaveBeenCalledWith(guildId)
      expect(mockGuildRepository.findOne).not.toHaveBeenCalled()
    })

    it("should fetch guild from database if not in cache", async () => {
      const guildId = "guild-123"
      const mockGuild = {
        id: guildId,
        name: "Test Guild",
        status: GuildStatus.ACTIVE,
      }

      mockCacheService.getGuild.mockResolvedValue(null)
      mockGuildRepository.findOne.mockResolvedValue(mockGuild)

      const result = await service.findGuildById(guildId)

      expect(result).toEqual(mockGuild)
      expect(mockCacheService.getGuild).toHaveBeenCalledWith(guildId)
      expect(mockGuildRepository.findOne).toHaveBeenCalledWith({
        where: { id: guildId },
        relations: ["members", "parentGuild", "subGuilds"],
      })
      expect(mockCacheService.cacheGuild).toHaveBeenCalledWith(mockGuild)
    })

    it("should throw NotFoundException if guild not found", async () => {
      const guildId = "non-existent-guild"

      mockCacheService.getGuild.mockResolvedValue(null)
      mockGuildRepository.findOne.mockResolvedValue(null)

      await expect(service.findGuildById(guildId)).rejects.toThrow(NotFoundException)
    })
  })

  describe("addGuildMember", () => {
    it("should add a member to guild successfully", async () => {
      const guildId = "guild-123"
      const addMemberDto = {
        userId: "user-456",
        role: GuildRole.MEMBER,
      }

      const mockGuild = {
        id: guildId,
        name: "Test Guild",
        maxMembers: 50,
        members: [],
        isAtCapacity: false,
      }

      const mockGuildMember = {
        id: "member-456",
        guildId,
        userId: addMemberDto.userId,
        role: addMemberDto.role,
        status: MemberStatus.ACTIVE,
      }

      jest.spyOn(service, "findGuildById").mockResolvedValue(mockGuild as any)
      mockGuildMemberRepository.findOne.mockResolvedValue(null)
      mockGuildMemberRepository.create.mockReturnValue(mockGuildMember)
      mockGuildMemberRepository.save.mockResolvedValue(mockGuildMember)

      const result = await service.addGuildMember(guildId, addMemberDto)

      expect(result).toEqual(mockGuildMember)
      expect(mockGuildMemberRepository.findOne).toHaveBeenCalledWith({
        where: { guildId, userId: addMemberDto.userId },
      })
      expect(mockGuildMemberRepository.create).toHaveBeenCalled()
      expect(mockGuildMemberRepository.save).toHaveBeenCalledWith(mockGuildMember)
      expect(mockEventEmitter.emit).toHaveBeenCalledWith("guild.member.joined", {
        guildId,
        member: mockGuildMember,
      })
    })

    it("should throw ConflictException if user is already a member", async () => {
      const guildId = "guild-123"
      const addMemberDto = {
        userId: "user-456",
        role: GuildRole.MEMBER,
      }

      const mockGuild = {
        id: guildId,
        isAtCapacity: false,
      }

      const existingMember = {
        id: "existing-member",
        guildId,
        userId: addMemberDto.userId,
      }

      jest.spyOn(service, "findGuildById").mockResolvedValue(mockGuild as any)
      mockGuildMemberRepository.findOne.mockResolvedValue(existingMember)

      await expect(service.addGuildMember(guildId, addMemberDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("getGuildHierarchy", () => {
    it("should return guild hierarchy correctly", async () => {
      const guildId = "child-guild"

      const parentGuild = {
        id: "parent-guild",
        name: "Parent Guild",
        parentGuild: null,
      }

      const childGuild = {
        id: "child-guild",
        name: "Child Guild",
        parentGuild: { id: "parent-guild" },
      }

      jest
        .spyOn(service, "findGuildById")
        .mockResolvedValueOnce(childGuild as any)
        .mockResolvedValueOnce(parentGuild as any)

      const result = await service.getGuildHierarchy(guildId)

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual(parentGuild)
      expect(result[1]).toEqual(childGuild)
    })
  })
})
