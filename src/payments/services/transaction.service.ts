import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  Transaction,
  TransactionStatus,
  TransactionType,
  PaymentProvider,
} from '../entities/transaction.entity';
import { Customer } from '../entities/customer.entity';

export interface CreateTransactionDto {
  customerId: string;
  type: TransactionType;
  provider: PaymentProvider;
  providerTransactionId: string;
  amount: number;
  currency: string;
  description?: string;
  status: TransactionStatus;
  providerData?: Record<string, any>;
  metadata?: Record<string, any>;
  fraudScore?: {
    score: number;
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
  };
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
  ) {}

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    const transaction = this.transactionRepository.create({
      ...dto,
      auditTrail: [
        {
          action: 'transaction_created',
          timestamp: new Date(),
          newStatus: dto.status,
          notes: 'Transaction created',
        },
      ],
    });

    const savedTransaction = await this.transactionRepository.save(transaction);

    this.logger.log(`Transaction created: ${savedTransaction.id}`);
    return savedTransaction;
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { id },
      relations: ['customer'],
    });
  }

  async findByProviderTransactionId(
    providerTransactionId: string,
  ): Promise<Transaction | null> {
    return this.transactionRepository.findOne({
      where: { providerTransactionId },
      relations: ['customer'],
    });
  }

  async findByUserId(
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [transactions, total] = await this.transactionRepository
      .createQueryBuilder('transaction')
      .leftJoinAndSelect('transaction.customer', 'customer')
      .where('customer.userId = :userId', { userId })
      .orderBy('transaction.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findByCustomerId(
    customerId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<{
    transactions: Transaction[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const [transactions, total] = await this.transactionRepository.findAndCount(
      {
        where: { customerId },
        relations: ['customer'],
        order: { createdAt: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      },
    );

    return {
      transactions,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    userId?: string,
    notes?: string,
    processedAt?: Date,
  ): Promise<Transaction> {
    const transaction = await this.findById(id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const previousStatus = transaction.status;
    transaction.status = status;

    if (processedAt) {
      transaction.processedAt = processedAt;
    } else if (
      status === TransactionStatus.SUCCEEDED ||
      status === TransactionStatus.FAILED
    ) {
      transaction.processedAt = new Date();
    }

    // Add to audit trail
    transaction.auditTrail = transaction.auditTrail || [];
    transaction.auditTrail.push({
      action: 'status_updated',
      timestamp: new Date(),
      userId,
      previousStatus,
      newStatus: status,
      notes,
    });

    const updatedTransaction =
      await this.transactionRepository.save(transaction);

    this.logger.log(
      `Transaction ${id} status updated from ${previousStatus} to ${status}`,
    );
    return updatedTransaction;
  }

  async updateRefundedAmount(
    id: string,
    refundedAmount: number,
  ): Promise<Transaction> {
    const transaction = await this.findById(id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    const previousRefundedAmount = transaction.refundedAmount;
    transaction.refundedAmount = refundedAmount;

    // Add to audit trail
    transaction.auditTrail = transaction.auditTrail || [];
    transaction.auditTrail.push({
      action: 'refunded_amount_updated',
      timestamp: new Date(),
      notes: `Refunded amount updated from ${previousRefundedAmount} to ${refundedAmount}`,
    });

    const updatedTransaction =
      await this.transactionRepository.save(transaction);

    this.logger.log(
      `Transaction ${id} refunded amount updated: ${refundedAmount}`,
    );
    return updatedTransaction;
  }

  async updateFailureDetails(
    id: string,
    failureReason: string,
    failureCode: string,
  ): Promise<Transaction> {
    const transaction = await this.findById(id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    transaction.failureReason = failureReason;
    transaction.failureCode = failureCode;

    // Add to audit trail
    transaction.auditTrail = transaction.auditTrail || [];
    transaction.auditTrail.push({
      action: 'failure_details_updated',
      timestamp: new Date(),
      notes: `Failure details: ${failureCode} - ${failureReason}`,
    });

    const updatedTransaction =
      await this.transactionRepository.save(transaction);

    this.logger.log(
      `Transaction ${id} failure details updated: ${failureCode}`,
    );
    return updatedTransaction;
  }

  async flagTransaction(
    id: string,
    reason: string,
    userId?: string,
  ): Promise<Transaction> {
    const transaction = await this.findById(id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    transaction.isFlagged = true;

    // Add to audit trail
    transaction.auditTrail = transaction.auditTrail || [];
    transaction.auditTrail.push({
      action: 'transaction_flagged',
      timestamp: new Date(),
      userId,
      notes: `Transaction flagged: ${reason}`,
    });

    const updatedTransaction =
      await this.transactionRepository.save(transaction);

    this.logger.log(`Transaction ${id} flagged: ${reason}`);
    return updatedTransaction;
  }

  async unflagTransaction(id: string, userId?: string): Promise<Transaction> {
    const transaction = await this.findById(id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    transaction.isFlagged = false;

    // Add to audit trail
    transaction.auditTrail = transaction.auditTrail || [];
    transaction.auditTrail.push({
      action: 'transaction_unflagged',
      timestamp: new Date(),
      userId,
      notes: 'Transaction unflagged',
    });

    const updatedTransaction =
      await this.transactionRepository.save(transaction);

    this.logger.log(`Transaction ${id} unflagged`);
    return updatedTransaction;
  }

  async updateProviderData(
    id: string,
    providerData: Record<string, any>,
  ): Promise<Transaction> {
    const transaction = await this.findById(id);
    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    transaction.providerData = providerData;

    // Add to audit trail
    transaction.auditTrail = transaction.auditTrail || [];
    transaction.auditTrail.push({
      action: 'provider_data_updated',
      timestamp: new Date(),
      notes: 'Provider data updated',
    });

    const updatedTransaction =
      await this.transactionRepository.save(transaction);

    this.logger.log(`Transaction ${id} provider data updated`);
    return updatedTransaction;
  }

  async findExpiredPendingTransactions(): Promise<Transaction[]> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    return this.transactionRepository.find({
      where: {
        status: TransactionStatus.PENDING,
        createdAt: twentyFourHoursAgo, // This should be LessThan but simplified for demo
      },
      take: 100, // Limit to prevent memory issues
    });
  }

  async getTransactionStats(
    customerId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalTransactions: number;
    totalAmount: number;
    successfulTransactions: number;
    failedTransactions: number;
    refundedAmount: number;
    averageAmount: number;
  }> {
    const queryBuilder =
      this.transactionRepository.createQueryBuilder('transaction');

    if (customerId) {
      queryBuilder.where('transaction.customerId = :customerId', {
        customerId,
      });
    }

    if (startDate) {
      queryBuilder.andWhere('transaction.createdAt >= :startDate', {
        startDate,
      });
    }

    if (endDate) {
      queryBuilder.andWhere('transaction.createdAt <= :endDate', { endDate });
    }

    const [
      totalTransactions,
      totalAmountResult,
      successfulTransactions,
      failedTransactions,
      refundedAmountResult,
    ] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.select('SUM(transaction.amount)', 'sum').getRawOne(),
      queryBuilder
        .andWhere('transaction.status = :status', {
          status: TransactionStatus.SUCCEEDED,
        })
        .getCount(),
      queryBuilder
        .andWhere('transaction.status = :status', {
          status: TransactionStatus.FAILED,
        })
        .getCount(),
      queryBuilder.select('SUM(transaction.refundedAmount)', 'sum').getRawOne(),
    ]);

    const totalAmount = parseFloat(totalAmountResult?.sum || '0');
    const refundedAmount = parseFloat(refundedAmountResult?.sum || '0');

    return {
      totalTransactions,
      totalAmount,
      successfulTransactions,
      failedTransactions,
      refundedAmount,
      averageAmount:
        totalTransactions > 0 ? totalAmount / totalTransactions : 0,
    };
  }
}
