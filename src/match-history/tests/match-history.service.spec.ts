import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { MatchHistoryService } from "../services/match-history.service"
import { MatchCacheService } from "../services/match-cache.service"
import { MatchHistory, GameMode } from "../entities/match-history.entity"
import { NotFoundException } from "@nestjs/common"
import { jest } from "@jest/globals"

describe("MatchHistoryService", () => {
  let service: MatchHistoryService
  let matchHistoryRepository: Repository<MatchHistory>
  let cacheService: MatchCacheService

  const mockMatchHistoryRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  }

  const mockCacheService = {
    cacheMatch: jest.fn(),
    getMatch: jest.fn(),
    removeMatch: jest.fn(),
    invalidateMatch: jest.fn(),
    cacheAggregatedData: jest.fn(),
    getAggregatedData: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchHistoryService,
        {
          provide: getRepositoryToken(MatchHistory),
          useValue: mockMatchHistoryRepository,
        },
        {
          provide: MatchCacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile()

    service = module.get<MatchHistoryService>(MatchHistoryService)
    matchHistoryRepository = module.get<Repository<MatchHistory>>(getRepositoryToken(MatchHistory))
    cacheService = module.get<MatchCacheService>(MatchCacheService)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const mockMatch = {
    id: "match-123",
    gameMode: GameMode.DEATHMATCH,
    mapName: "Dust II",
    startTime: new Date("2023-01-01T10:00:00Z"),
    endTime: new Date("2023-01-01T10:30:00Z"),
    duration: 1800,
    winningTeamId: "team-a",
    playerResults: [
      {
        userId: "user-1",
        teamId: "team-a",
        score: 100,
        kills: 20,
        deaths: 5,
        assists: 3,
        damageDealt: 2500,
        damageTaken: 1000,
        healingDone: 0,
        objectiveScore: 10,
        performanceMetrics: {},
      },
      {
        userId: "user-2",
        teamId: "team-b",
        score: 80,
        kills: 15,
        deaths: 10,
        assists: 5,
        damageDealt: 2000,
        damageTaken: 1200,
        healingDone: 50,
        objectiveScore: 5,
        performanceMetrics: {},
      },
    ],
    replayData: [],
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe("createMatch", () => {
    it("should create a match successfully", async () => {
      mockMatchHistoryRepository.create.mockReturnValue(mockMatch)
      mockMatchHistoryRepository.save.mockResolvedValue(mockMatch)

      const result = await service.createMatch(mockMatch as any)

      expect(result).toEqual(mockMatch)
      expect(mockMatchHistoryRepository.create).toHaveBeenCalledWith(mockMatch)
      expect(mockMatchHistoryRepository.save).toHaveBeenCalledWith(mockMatch)
      expect(mockCacheService.cacheMatch).toHaveBeenCalledWith(mockMatch)
    })
  })

  describe("findMatchById", () => {
    it("should return match from cache if available", async () => {
      mockCacheService.getMatch.mockResolvedValue(mockMatch)

      const result = await service.findMatchById(mockMatch.id)

      expect(result).toEqual(mockMatch)
      expect(mockCacheService.getMatch).toHaveBeenCalledWith(mockMatch.id)
      expect(mockMatchHistoryRepository.findOne).not.toHaveBeenCalled()
    })

    it("should fetch match from database if not in cache", async () => {
      mockCacheService.getMatch.mockResolvedValue(null)
      mockMatchHistoryRepository.findOne.mockResolvedValue(mockMatch)

      const result = await service.findMatchById(mockMatch.id)

      expect(result).toEqual(mockMatch)
      expect(mockCacheService.getMatch).toHaveBeenCalledWith(mockMatch.id)
      expect(mockMatchHistoryRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockMatch.id },
      })
      expect(mockCacheService.cacheMatch).toHaveBeenCalledWith(mockMatch)
    })

    it("should throw NotFoundException if match not found", async () => {
      mockCacheService.getMatch.mockResolvedValue(null)
      mockMatchHistoryRepository.findOne.mockResolvedValue(null)

      await expect(service.findMatchById("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("deleteMatch", () => {
    it("should delete a match successfully", async () => {
      mockMatchHistoryRepository.delete.mockResolvedValue({ affected: 1 })

      await service.deleteMatch(mockMatch.id)

      expect(mockMatchHistoryRepository.delete).toHaveBeenCalledWith(mockMatch.id)
      expect(mockCacheService.removeMatch).toHaveBeenCalledWith(mockMatch.id)
    })

    it("should throw NotFoundException if match not found", async () => {
      mockMatchHistoryRepository.delete.mockResolvedValue({ affected: 0 })

      await expect(service.deleteMatch("non-existent-id")).rejects.toThrow(NotFoundException)
    })
  })

  describe("findAllMatches", () => {
    it("should return all matches with basic filtering", async () => {
      const query = { gameMode: GameMode.DEATHMATCH, limit: 1, offset: 0 }
      mockMatchHistoryRepository.find.mockResolvedValue([mockMatch])

      const result = await service.findAllMatches(query)

      expect(result).toEqual([mockMatch])
      expect(mockMatchHistoryRepository.find).toHaveBeenCalledWith({
        where: { gameMode: GameMode.DEATHMATCH },
        order: { startTime: "DESC" },
        take: 1,
        skip: 0,
      })
    })

    it("should filter by userId within playerResults", async () => {
      const query = { userId: "user-1" }
      const mockMatches = [
        {
          ...mockMatch,
          playerResults: [{ userId: "user-1" }, { userId: "user-3" }],
        },
        {
          ...mockMatch,
          id: "match-456",
          playerResults: [{ userId: "user-2" }],
        },
      ]
      mockMatchHistoryRepository.find.mockResolvedValue(mockMatches)

      const result = await service.findAllMatches(query)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe(mockMatches[0].id)
    })
  })

  describe("getMatchPerformanceAnalysis", () => {
    it("should return performance analysis for a match", async () => {
      jest.spyOn(service, "findMatchById").mockResolvedValue(mockMatch as any)

      const result = await service.getMatchPerformanceAnalysis(mockMatch.id)

      expect(result).toHaveProperty("matchId", mockMatch.id)
      expect(result.playerAnalysis).toHaveLength(2)
      expect(result.playerAnalysis[0].userId).toBe("user-1")
      expect(result.playerAnalysis[0].kda).toBeCloseTo(4.6) // (20+3)/5 = 4.6
      expect(result.playerAnalysis[0].damagePerMinute).toBeCloseTo(83.33) // 2500 / (1800/60) = 2500 / 30 = 83.33
    })

    it("should return performance analysis for a specific user in a match", async () => {
      jest.spyOn(service, "findMatchById").mockResolvedValue(mockMatch as any)

      const result = await service.getMatchPerformanceAnalysis(mockMatch.id, "user-2")

      expect(result.playerAnalysis).toHaveLength(1)
      expect(result.playerAnalysis[0].userId).toBe("user-2")
      expect(result.playerAnalysis[0].kda).toBeCloseTo(2.0) // (15+5)/10 = 2.0
    })

    it("should throw NotFoundException if user not found in match", async () => {
      jest.spyOn(service, "findMatchById").mockResolvedValue(mockMatch as any)

      await expect(service.getMatchPerformanceAnalysis(mockMatch.id, "non-existent-user")).rejects.toThrow(
        NotFoundException,
      )
    })
  })

  describe("getPlayerMatchHistory", () => {
    it("should return match history for a specific player", async () => {
      const userId = "user-1"
      const query = { limit: 10, offset: 0 }
      const mockMatches = [mockMatch]

      mockMatchHistoryRepository.createQueryBuilder().getMany.mockResolvedValue(mockMatches)

      const result = await service.getPlayerMatchHistory(userId, query)

      expect(result).toEqual(mockMatches)
      expect(mockMatchHistoryRepository.createQueryBuilder().where).toHaveBeenCalledWith(
        ":userId = ANY(SELECT jsonb_array_elements(match.playerResults)->>'userId')",
        { userId },
      )
    })
  })

  describe("getMatchComparison", () => {
    it("should compare two matches", async () => {
      const mockMatch2 = {
        ...mockMatch,
        id: "match-456",
        mapName: "Inferno",
        playerResults: [{ userId: "user-1" }, { userId: "user-4" }],
      }
      jest
        .spyOn(service, "findMatchById")
        .mockResolvedValueOnce(mockMatch as any)
        .mockResolvedValueOnce(mockMatch2 as any)

      const result = await service.getMatchComparison(mockMatch.id, mockMatch2.id)

      expect(result.match1.id).toBe(mockMatch.id)
      expect(result.match2.id).toBe(mockMatch2.id)
      expect(result.commonPlayers).toEqual(["user-1"])
    })
  })

  describe("getPlayerTrends", () => {
    it("should return player trends", async () => {
      const userId = "user-1"
      const mockMatches = [
        {
          ...mockMatch,
          playerResults: [{ userId: "user-1", kills: 10, deaths: 5, assists: 2, damageDealt: 1000, healingDone: 0 }],
          duration: 600,
        },
        {
          ...mockMatch,
          id: "match-456",
          startTime: new Date("2023-01-02T10:00:00Z"),
          playerResults: [{ userId: "user-1", kills: 15, deaths: 3, assists: 5, damageDealt: 1500, healingDone: 100 }],
          duration: 900,
        },
      ]
      jest.spyOn(service, "getPlayerMatchHistory").mockResolvedValue(mockMatches as any)

      const result = await service.getPlayerTrends(userId)

      expect(result.userId).toBe(userId)
      expect(result.trends.kda).toHaveLength(2)
      expect(result.trends.kda[0].value).toBeCloseTo(2.4) // (10+2)/5 = 2.4
      expect(result.trends.kda[1].value).toBeCloseTo(6.67) // (15+5)/3 = 6.666...
    })
  })
})
