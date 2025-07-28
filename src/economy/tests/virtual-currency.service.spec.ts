import { Test, type TestingModule } from "@nestjs/testing"
import { getRepositoryToken } from "@nestjs/typeorm"
import type { Repository } from "typeorm"
import { VirtualCurrencyService } from "../services/virtual-currency.service"
import { VirtualCurrency } from "../entities/virtual-currency.entity"
import { Transaction, TransactionType } from "../entities/transaction.entity"
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common"
import { jest } from "@jest/globals"

describe("VirtualCurrencyService", () => {
  let service: VirtualCurrencyService
  let virtualCurrencyRepository: Repository<VirtualCurrency>
  let transactionRepository: Repository<Transaction>
  let entityManager: any

  const mockVirtualCurrencyRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
    })),
  }

  const mockTransactionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
    })),
  }

  const mockEntityManager = {
    transaction: jest.fn((cb) => cb(mockEntityManager)),
    findOne: jest.fn(),
    save: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VirtualCurrencyService,
        {
          provide: getRepositoryToken(VirtualCurrency),
          useValue: mockVirtualCurrencyRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTransactionRepository,
        },
        {
          provide: "EntityManager",
          useValue: mockEntityManager,
        },
      ],
    }).compile()

    service = module.get<VirtualCurrencyService>(VirtualCurrencyService)
    virtualCurrencyRepository = module.get<Repository<VirtualCurrency>>(getRepositoryToken(VirtualCurrency))
    transactionRepository = module.get<Repository<Transaction>>(getRepositoryToken(Transaction))
    entityManager = module.get<any>("EntityManager")
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  const mockAccount = {
    id: "acc-123",
    userId: "user-1",
    currencyCode: "GOLD",
    balance: "100.0000",
  }

  describe("createCurrencyAccount", () => {
    it("should create a currency account successfully", async () => {
      const createDto = { userId: "user-1", currencyCode: "GOLD" }
      mockVirtualCurrencyRepository.findOne.mockResolvedValue(null)
      mockVirtualCurrencyRepository.create.mockReturnValue(mockAccount)
      mockVirtualCurrencyRepository.save.mockResolvedValue(mockAccount)

      const result = await service.createCurrencyAccount(createDto)

      expect(result).toEqual(mockAccount)
      expect(mockVirtualCurrencyRepository.findOne).toHaveBeenCalledWith({
        where: { userId: createDto.userId, currencyCode: createDto.currencyCode },
      })
      expect(mockVirtualCurrencyRepository.create).toHaveBeenCalledWith(createDto)
      expect(mockVirtualCurrencyRepository.save).toHaveBeenCalledWith(mockAccount)
    })

    it("should throw ConflictException if account already exists", async () => {
      const createDto = { userId: "user-1", currencyCode: "GOLD" }
      mockVirtualCurrencyRepository.findOne.mockResolvedValue(mockAccount)

      await expect(service.createCurrencyAccount(createDto)).rejects.toThrow(ConflictException)
    })
  })

  describe("getAccountBalance", () => {
    it("should return account balance", async () => {
      mockVirtualCurrencyRepository.findOne.mockResolvedValue(mockAccount)

      const result = await service.getAccountBalance("user-1", "GOLD")

      expect(result).toEqual(mockAccount)
      expect(mockVirtualCurrencyRepository.findOne).toHaveBeenCalledWith({
        where: { userId: "user-1", currencyCode: "GOLD" },
      })
    })

    it("should throw NotFoundException if account not found", async () => {
      mockVirtualCurrencyRepository.findOne.mockResolvedValue(null)

      await expect(service.getAccountBalance("user-nonexistent", "GOLD")).rejects.toThrow(NotFoundException)
    })
  })

  describe("deposit", () => {
    it("should deposit currency and record transaction", async () => {
      const depositAmount = "50.0000"
      const expectedBalance = "150.0000"
      const mockTransaction = {
        id: "tx-123",
        transactionType: TransactionType.DEPOSIT,
        currencyCode: "GOLD",
        amount: depositAmount,
        fromAccountId: "SYSTEM_DEPOSIT",
        toAccountId: "user-1",
      }

      entityManager.findOne.mockResolvedValue({ ...mockAccount }) // Clone to avoid modifying original mock
      entityManager.save
        .mockResolvedValueOnce({ ...mockAccount, balance: expectedBalance })
        .mockResolvedValueOnce(mockTransaction)

      const result = await service.deposit("user-1", "GOLD", depositAmount)

      expect(result).toEqual(mockTransaction)
      expect(entityManager.findOne).toHaveBeenCalledWith(
        VirtualCurrency,
        expect.objectContaining({
          where: { userId: "user-1", currencyCode: "GOLD" },
          lock: { mode: "for_update" },
        }),
      )
      expect(entityManager.save).toHaveBeenCalledWith(
        VirtualCurrency,
        expect.objectContaining({ balance: expectedBalance }),
      )
      expect(entityManager.create).toHaveBeenCalledWith(
        Transaction,
        expect.objectContaining({
          transactionType: TransactionType.DEPOSIT,
          amount: depositAmount,
          toAccountId: "user-1",
        }),
      )
      expect(entityManager.save).toHaveBeenCalledWith(Transaction, expect.any(Transaction))
    })

    it("should throw BadRequestException for non-positive deposit", async () => {
      await expect(service.deposit("user-1", "GOLD", "0.0000")).rejects.toThrow(BadRequestException)
      await expect(service.deposit("user-1", "GOLD", "-10.0000")).rejects.toThrow(BadRequestException)
    })
  })

  describe("withdraw", () => {
    it("should withdraw currency and record transaction", async () => {
      const withdrawAmount = "20.0000"
      const expectedBalance = "80.0000"
      const mockTransaction = {
        id: "tx-456",
        transactionType: TransactionType.WITHDRAW,
        currencyCode: "GOLD",
        amount: withdrawAmount,
        fromAccountId: "user-1",
        toAccountId: "SYSTEM_WITHDRAW",
      }

      entityManager.findOne.mockResolvedValue({ ...mockAccount })
      entityManager.save
        .mockResolvedValueOnce({ ...mockAccount, balance: expectedBalance })
        .mockResolvedValueOnce(mockTransaction)

      const result = await service.withdraw("user-1", "GOLD", withdrawAmount)

      expect(result).toEqual(mockTransaction)
      expect(entityManager.save).toHaveBeenCalledWith(
        VirtualCurrency,
        expect.objectContaining({ balance: expectedBalance }),
      )
      expect(entityManager.create).toHaveBeenCalledWith(
        Transaction,
        expect.objectContaining({
          transactionType: TransactionType.WITHDRAW,
          amount: withdrawAmount,
          fromAccountId: "user-1",
        }),
      )
    })

    it("should throw BadRequestException for insufficient balance", async () => {
      entityManager.findOne.mockResolvedValue({ ...mockAccount, balance: "10.0000" }) // Low balance

      await expect(service.withdraw("user-1", "GOLD", "20.0000")).rejects.toThrow(BadRequestException)
    })
  })

  describe("transfer", () => {
    it("should transfer currency between users and record transaction", async () => {
      const fromUser = "user-1"
      const toUser = "user-2"
      const transferAmount = "30.0000"
      const fromAccount = { ...mockAccount, userId: fromUser, balance: "100.0000" }
      const toAccount = {
        id: "acc-456",
        userId: toUser,
        currencyCode: "GOLD",
        balance: "50.0000",
      }
      const mockTransaction = {
        id: "tx-789",
        transactionType: TransactionType.TRANSFER,
        currencyCode: "GOLD",
        amount: transferAmount,
        fromAccountId: fromUser,
        toAccountId: toUser,
      }

      entityManager.findOne.mockResolvedValueOnce(fromAccount).mockResolvedValueOnce(toAccount)
      entityManager.save
        .mockResolvedValueOnce({ ...fromAccount, balance: "70.0000" })
        .mockResolvedValueOnce({ ...toAccount, balance: "80.0000" })
        .mockResolvedValueOnce(mockTransaction)

      const result = await service.transfer(fromUser, toUser, "GOLD", transferAmount)

      expect(result).toEqual(mockTransaction)
      expect(entityManager.save).toHaveBeenCalledWith([
        expect.objectContaining({ userId: fromUser, balance: "70.0000" }),
        expect.objectContaining({ userId: toUser, balance: "80.0000" }),
      ])
      expect(entityManager.create).toHaveBeenCalledWith(
        Transaction,
        expect.objectContaining({
          transactionType: TransactionType.TRANSFER,
          amount: transferAmount,
          fromAccountId: fromUser,
          toAccountId: toUser,
        }),
      )
    })

    it("should throw BadRequestException if transferring to same account", async () => {
      await expect(service.transfer("user-1", "user-1", "GOLD", "10.0000")).rejects.toThrow(BadRequestException)
    })

    it("should throw BadRequestException for insufficient sender balance", async () => {
      const fromAccount = { ...mockAccount, balance: "10.0000" }
      const toAccount = { ...mockAccount, id: "acc-456", userId: "user-2", balance: "50.0000" }
      entityManager.findOne.mockResolvedValueOnce(fromAccount).mockResolvedValueOnce(toAccount)

      await expect(service.transfer("user-1", "user-2", "GOLD", "20.0000")).rejects.toThrow(BadRequestException)
    })
  })

  describe("getTransactionHistory", () => {
    it("should return transaction history for an account", async () => {
      const mockTransactions = [
        { id: "tx1", fromAccountId: "user-1", toAccountId: "user-2", amount: "10" },
        { id: "tx2", fromAccountId: "user-3", toAccountId: "user-1", amount: "5" },
      ]
      mockTransactionRepository.createQueryBuilder().getMany.mockResolvedValue(mockTransactions)

      const query = { accountId: "user-1" }
      const result = await service.getTransactionHistory(query)

      expect(result).toEqual(mockTransactions)
      expect(mockTransactionRepository.createQueryBuilder().where).toHaveBeenCalledWith(
        "transaction.fromAccountId = :accountId OR transaction.toAccountId = :accountId",
        { accountId: "user-1" },
      )
    })
  })

  describe("getEconomicOverview", () => {
    it("should return economic overview data", async () => {
      const mockTotalCurrency = [{ currencyCode: "GOLD", totalBalance: "1000.0000" }]
      const mockTotalTransactions = 500
      const mockTransactionVolume = [{ currencyCode: "GOLD", totalAmount: "5000.0000" }]

      mockVirtualCurrencyRepository.createQueryBuilder().getRawMany.mockResolvedValue(mockTotalCurrency)
      mockTransactionRepository.count.mockResolvedValue(mockTotalTransactions)
      mockTransactionRepository.createQueryBuilder().getRawMany.mockResolvedValue(mockTransactionVolume)

      const result = await service.getEconomicOverview()

      expect(result).toEqual({
        totalCurrencyInCirculation: mockTotalCurrency,
        totalTransactions: mockTotalTransactions,
        transactionVolume: mockTransactionVolume,
      })
    })
  })
})
