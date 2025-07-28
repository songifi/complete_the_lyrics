import { Injectable, NotFoundException, BadRequestException, ConflictException } from "@nestjs/common"
import type { Repository, EntityManager } from "typeorm"
import { VirtualCurrency } from "../entities/virtual-currency.entity"
import { Transaction, TransactionType } from "../entities/transaction.entity"
import type { CreateVirtualCurrencyDto } from "../dto/create-currency.dto"
import type { TransactionQueryDto } from "../dto/transaction-query.dto"
import { Decimal } from "decimal.js" // For precise arithmetic

@Injectable()
export class VirtualCurrencyService {
  constructor(
    private virtualCurrencyRepository: Repository<VirtualCurrency>,
    private transactionRepository: Repository<Transaction>,
    private readonly entityManager: EntityManager, // For manual transaction management
  ) {}

  async createCurrencyAccount(createCurrencyDto: CreateVirtualCurrencyDto): Promise<VirtualCurrency> {
    const existingAccount = await this.virtualCurrencyRepository.findOne({
      where: {
        userId: createCurrencyDto.userId,
        currencyCode: createCurrencyDto.currencyCode,
      },
    })

    if (existingAccount) {
      throw new ConflictException(
        `Currency account for user ${createCurrencyDto.userId} with code ${createCurrencyDto.currencyCode} already exists.`,
      )
    }

    const account = this.virtualCurrencyRepository.create(createCurrencyDto)
    return this.virtualCurrencyRepository.save(account)
  }

  async getAccountBalance(userId: string, currencyCode: string): Promise<VirtualCurrency> {
    const account = await this.virtualCurrencyRepository.findOne({
      where: { userId, currencyCode },
    })
    if (!account) {
      throw new NotFoundException(`Currency account for user ${userId} with code ${currencyCode} not found.`)
    }
    return account
  }

  async deposit(
    userId: string,
    currencyCode: string,
    amount: string,
    description?: string,
    metadata?: Record<string, any>,
  ): Promise<Transaction> {
    if (new Decimal(amount).isNegative() || new Decimal(amount).isZero()) {
      throw new BadRequestException("Deposit amount must be positive.")
    }

    return this.entityManager.transaction(async (transactionalEntityManager) => {
      const account = await transactionalEntityManager
        .findOne(VirtualCurrency, {
          where: { userId, currencyCode },
          lock: { mode: "for_update" }, // Acquire row-level lock
        })
        .then((acc) => {
          if (!acc) {
            throw new NotFoundException(`Currency account for user ${userId} with code ${currencyCode} not found.`)
          }
          return acc
        })

      const newBalance = new Decimal(account.balance).plus(amount).toFixed(4)
      account.balance = newBalance

      await transactionalEntityManager.save(VirtualCurrency, account)

      const transaction = transactionalEntityManager.create(Transaction, {
        transactionType: TransactionType.DEPOSIT,
        currencyCode,
        amount,
        fromAccountId: "SYSTEM_DEPOSIT", // Represents the source of the currency
        toAccountId: userId,
        description: description || `Deposit of ${amount} ${currencyCode} to ${userId}`,
        metadata,
      })
      return transactionalEntityManager.save(Transaction, transaction)
    })
  }

  async withdraw(
    userId: string,
    currencyCode: string,
    amount: string,
    description?: string,
    metadata?: Record<string, any>,
  ): Promise<Transaction> {
    if (new Decimal(amount).isNegative() || new Decimal(amount).isZero()) {
      throw new BadRequestException("Withdrawal amount must be positive.")
    }

    return this.entityManager.transaction(async (transactionalEntityManager) => {
      const account = await transactionalEntityManager
        .findOne(VirtualCurrency, {
          where: { userId, currencyCode },
          lock: { mode: "for_update" }, // Acquire row-level lock
        })
        .then((acc) => {
          if (!acc) {
            throw new NotFoundException(`Currency account for user ${userId} with code ${currencyCode} not found.`)
          }
          return acc
        })

      if (new Decimal(account.balance).lessThan(amount)) {
        throw new BadRequestException(
          `Insufficient balance for withdrawal. Current: ${account.balance}, Needed: ${amount}`,
        )
      }

      const newBalance = new Decimal(account.balance).minus(amount).toFixed(4)
      account.balance = newBalance

      await transactionalEntityManager.save(VirtualCurrency, account)

      const transaction = transactionalEntityManager.create(Transaction, {
        transactionType: TransactionType.WITHDRAW,
        currencyCode,
        amount,
        fromAccountId: userId,
        toAccountId: "SYSTEM_WITHDRAW", // Represents the destination of the currency
        description: description || `Withdrawal of ${amount} ${currencyCode} from ${userId}`,
        metadata,
      })
      return transactionalEntityManager.save(Transaction, transaction)
    })
  }

  async transfer(
    fromUserId: string,
    toUserId: string,
    currencyCode: string,
    amount: string,
    description?: string,
    metadata?: Record<string, any>,
  ): Promise<Transaction> {
    if (new Decimal(amount).isNegative() || new Decimal(amount).isZero()) {
      throw new BadRequestException("Transfer amount must be positive.")
    }
    if (fromUserId === toUserId) {
      throw new BadRequestException("Cannot transfer to the same account.")
    }

    return this.entityManager.transaction(async (transactionalEntityManager) => {
      const [fromAccount, toAccount] = await Promise.all([
        transactionalEntityManager.findOne(VirtualCurrency, {
          where: { userId: fromUserId, currencyCode },
          lock: { mode: "for_update" },
        }),
        transactionalEntityManager.findOne(VirtualCurrency, {
          where: { userId: toUserId, currencyCode },
          lock: { mode: "for_update" },
        }),
      ])

      if (!fromAccount) {
        throw new NotFoundException(`Sender account for user ${fromUserId} with code ${currencyCode} not found.`)
      }
      if (!toAccount) {
        throw new NotFoundException(`Receiver account for user ${toUserId} with code ${currencyCode} not found.`)
      }

      if (new Decimal(fromAccount.balance).lessThan(amount)) {
        throw new BadRequestException(
          `Insufficient balance for transfer. Current: ${fromAccount.balance}, Needed: ${amount}`,
        )
      }

      fromAccount.balance = new Decimal(fromAccount.balance).minus(amount).toFixed(4)
      toAccount.balance = new Decimal(toAccount.balance).plus(amount).toFixed(4)

      await transactionalEntityManager.save([fromAccount, toAccount])

      const transaction = transactionalEntityManager.create(Transaction, {
        transactionType: TransactionType.TRANSFER,
        currencyCode,
        amount,
        fromAccountId: fromUserId,
        toAccountId: toUserId,
        description: description || `Transfer of ${amount} ${currencyCode} from ${fromUserId} to ${toUserId}`,
        metadata,
      })
      return transactionalEntityManager.save(Transaction, transaction)
    })
  }

  async getTransactionHistory(query: TransactionQueryDto): Promise<Transaction[]> {
    const qb = this.transactionRepository.createQueryBuilder("transaction")

    if (query.accountId) {
      qb.where("transaction.fromAccountId = :accountId OR transaction.toAccountId = :accountId", {
        accountId: query.accountId,
      })
    }

    if (query.transactionType) {
      qb.andWhere("transaction.transactionType = :transactionType", {
        transactionType: query.transactionType,
      })
    }
    if (query.currencyCode) {
      qb.andWhere("transaction.currencyCode = :currencyCode", {
        currencyCode: query.currencyCode,
      })
    }
    if (query.startDate && query.endDate) {
      qb.andWhere("transaction.createdAt BETWEEN :startDate AND :endDate", {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      })
    } else if (query.startDate) {
      qb.andWhere("transaction.createdAt >= :startDate", { startDate: new Date(query.startDate) })
    } else if (query.endDate) {
      qb.andWhere("transaction.createdAt <= :endDate", { endDate: new Date(query.endDate) })
    }

    qb.orderBy("transaction.createdAt", "DESC")
    qb.take(query.limit)
    qb.skip(query.offset)

    return qb.getMany()
  }

  async getEconomicOverview(): Promise<any> {
    const totalCurrencyInCirculation = await this.virtualCurrencyRepository
      .createQueryBuilder("vc")
      .select("vc.currencyCode")
      .addSelect("SUM(vc.balance)", "totalBalance")
      .groupBy("vc.currencyCode")
      .getRawMany()

    const totalTransactions = await this.transactionRepository.count()
    const transactionVolume = await this.transactionRepository
      .createQueryBuilder("t")
      .select("t.currencyCode")
      .addSelect("SUM(t.amount)", "totalAmount")
      .groupBy("t.currencyCode")
      .getRawMany()

    return {
      totalCurrencyInCirculation,
      totalTransactions,
      transactionVolume,
    }
  }
}
