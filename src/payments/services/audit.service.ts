import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

export interface PaymentAuditEvent {
  transactionId?: string;
  customerId?: string;
  userId?: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

// Simple audit log entity for demonstration
// In production, you might want a separate audit table
export interface AuditLog {
  id: string;
  transactionId?: string;
  customerId?: string;
  userId?: string;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  timestamp: Date;
  checksum: string; // For integrity verification
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor() {
    // In a real implementation, you would inject an audit log repository
    // @InjectRepository(AuditLog)
    // private readonly auditLogRepository: Repository<AuditLog>,
  }

  async logPaymentEvent(event: PaymentAuditEvent): Promise<void> {
    try {
      const auditEntry = {
        id: this.generateId(),
        ...event,
        timestamp: new Date(),
        checksum: this.calculateChecksum(event),
      };

      // In production, save to audit table
      // await this.auditLogRepository.save(auditEntry);

      // For now, just log to console with structured format
      this.logger.log(
        JSON.stringify({
          type: 'PAYMENT_AUDIT',
          ...auditEntry,
        }),
      );

      // Also log to external audit service (like AWS CloudTrail, etc.)
      await this.logToExternalService(auditEntry);
    } catch (error) {
      this.logger.error(
        `Failed to log audit event: ${error.message}`,
        error.stack,
      );
      // Never throw from audit logging to avoid breaking payment flow
    }
  }

  async logSecurityEvent(event: {
    action: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
    riskLevel: 'low' | 'medium' | 'high';
    details: Record<string, any>;
  }): Promise<void> {
    try {
      const auditEntry = {
        id: this.generateId(),
        type: 'SECURITY_EVENT',
        ...event,
        timestamp: new Date(),
        checksum: this.calculateChecksum(event),
      };

      this.logger.warn(
        JSON.stringify({
          type: 'SECURITY_AUDIT',
          ...auditEntry,
        }),
      );

      await this.logToExternalService(auditEntry);
    } catch (error) {
      this.logger.error(
        `Failed to log security event: ${error.message}`,
        error.stack,
      );
    }
  }

  async logFraudEvent(event: {
    transactionId?: string;
    userId?: string;
    action: string;
    fraudScore: number;
    riskLevel: 'low' | 'medium' | 'high';
    factors: string[];
    blocked: boolean;
    details: Record<string, any>;
  }): Promise<void> {
    try {
      const auditEntry = {
        id: this.generateId(),
        type: 'FRAUD_EVENT',
        ...event,
        timestamp: new Date(),
        checksum: this.calculateChecksum(event),
      };

      if (event.riskLevel === 'high' || event.blocked) {
        this.logger.warn(
          JSON.stringify({
            type: 'FRAUD_AUDIT',
            ...auditEntry,
          }),
        );
      } else {
        this.logger.log(
          JSON.stringify({
            type: 'FRAUD_AUDIT',
            ...auditEntry,
          }),
        );
      }

      await this.logToExternalService(auditEntry);
    } catch (error) {
      this.logger.error(
        `Failed to log fraud event: ${error.message}`,
        error.stack,
      );
    }
  }

  async logWebhookEvent(event: {
    webhookEventId: string;
    provider: string;
    eventType: string;
    processed: boolean;
    errorMessage?: string;
    retryCount?: number;
  }): Promise<void> {
    try {
      const auditEntry = {
        id: this.generateId(),
        type: 'WEBHOOK_EVENT',
        ...event,
        timestamp: new Date(),
        checksum: this.calculateChecksum(event),
      };

      this.logger.log(
        JSON.stringify({
          type: 'WEBHOOK_AUDIT',
          ...auditEntry,
        }),
      );

      await this.logToExternalService(auditEntry);
    } catch (error) {
      this.logger.error(
        `Failed to log webhook event: ${error.message}`,
        error.stack,
      );
    }
  }

  private generateId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateChecksum(data: any): string {
    // Simple checksum for demonstration
    // In production, use a proper hash function like SHA-256
    const crypto = require('crypto');
    const serialized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(serialized).digest('hex');
  }

  private async logToExternalService(auditEntry: any): Promise<void> {
    // In production, send to external audit service
    // Examples: AWS CloudTrail, Splunk, ELK Stack, etc.

    // For demonstration, just simulate async operation
    await new Promise((resolve) => setTimeout(resolve, 1));

    // Example implementation:
    // await this.cloudTrailService.log(auditEntry);
    // await this.splunkService.log(auditEntry);
  }

  async getAuditTrail(filters: {
    transactionId?: string;
    userId?: string;
    action?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
  }): Promise<{
    events: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    // In production, query from audit log repository
    // For now, return mock data

    const mockEvents = [
      {
        id: 'audit_1',
        action: 'payment_intent_created',
        timestamp: new Date(),
        details: { amount: 100, currency: 'USD' },
      },
    ];

    return {
      events: mockEvents,
      total: mockEvents.length,
      page: filters.page || 1,
      totalPages: 1,
    };
  }
}
