import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TransactionService } from '../services/transaction.service';
import { CustomerService } from '../services/customer.service';
import { AuditService } from '../services/audit.service';

@Injectable()
export class PaymentAuthGuard extends JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(PaymentAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly transactionService: TransactionService,
    private readonly customerService: CustomerService,
    private readonly auditService: AuditService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // First, check JWT authentication
    const isJwtValid = await super.canActivate(context);
    if (!isJwtValid) {
      return false;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;
    const path = request.path;

    try {
      // Enhanced security checks for payment operations
      await this.performPaymentSecurityChecks(user, request, context);

      // Log the access attempt
      await this.auditService.logSecurityEvent({
        action: 'payment_access_granted',
        userId: user.id,
        ipAddress: this.getClientIp(request),
        userAgent: request.headers['user-agent'],
        riskLevel: 'low',
        details: {
          method,
          path,
          timestamp: new Date(),
        },
      });

      return true;
    } catch (error) {
      // Log the security violation
      await this.auditService.logSecurityEvent({
        action: 'payment_access_denied',
        userId: user?.id,
        ipAddress: this.getClientIp(request),
        userAgent: request.headers['user-agent'],
        riskLevel: 'high',
        details: {
          method,
          path,
          reason: error.message,
          timestamp: new Date(),
        },
      });

      this.logger.warn(
        `Payment access denied for user ${user?.id}: ${error.message}`,
      );
      throw error;
    }
  }

  private async performPaymentSecurityChecks(
    user: any,
    request: any,
    context: ExecutionContext,
  ): Promise<void> {
    // Check if user account is active and not suspended
    if (user.status === 'suspended') {
      throw new ForbiddenException('Account suspended - payment access denied');
    }

    // Check for suspicious IP patterns
    const clientIp = this.getClientIp(request);
    if (await this.isSuspiciousIp(clientIp)) {
      throw new ForbiddenException('Access denied from suspicious IP address');
    }

    // Check for rate limiting violations
    await this.checkRateLimit(user.id, clientIp);

    // Resource-specific authorization checks
    await this.checkResourceAccess(user, request, context);

    // Additional security validations for high-value operations
    if (await this.isHighValueOperation(request)) {
      await this.performEnhancedSecurityChecks(user, request);
    }
  }

  private async checkResourceAccess(
    user: any,
    request: any,
    context: ExecutionContext,
  ): Promise<void> {
    const { params, body } = request;

    // Check transaction access
    if (params.transactionId) {
      const transaction = await this.transactionService.findById(
        params.transactionId,
      );
      if (transaction && transaction.customer) {
        if (transaction.customer.userId !== user.id && user.role !== 'admin') {
          throw new ForbiddenException('Access denied to transaction');
        }
      }
    }

    // Check customer access
    if (params.customerId) {
      const customer = await this.customerService.findById(params.customerId);
      if (customer && customer.userId !== user.id && user.role !== 'admin') {
        throw new ForbiddenException('Access denied to customer data');
      }
    }

    // Check if user is trying to access someone else's payment data
    if (body.userId && body.userId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Cannot perform operations for other users');
    }
  }

  private async checkRateLimit(
    userId: string,
    ipAddress: string,
  ): Promise<void> {
    // In production, implement proper rate limiting with Redis
    // For now, just a basic check
    const key = `rate_limit_${userId}_${ipAddress}`;
    // Mock rate limit implementation
    // This should be replaced with actual Redis-based rate limiting
  }

  private async isSuspiciousIp(ipAddress: string): Promise<boolean> {
    // Check against known malicious IP lists
    // Check if IP is from a blocked country/region
    // Check if IP is from a known VPN/proxy service

    // Mock implementation
    const suspiciousPatterns = ['127.0.0.1']; // Just for demo
    return suspiciousPatterns.some((pattern) => ipAddress.includes(pattern));
  }

  private async isHighValueOperation(request: any): Promise<boolean> {
    const { body, path } = request;

    // Define what constitutes a high-value operation
    if (path.includes('/refund') || path.includes('/cancel')) {
      return true;
    }

    if (body.amount && body.amount > 1000) {
      return true;
    }

    return false;
  }

  private async performEnhancedSecurityChecks(
    user: any,
    request: any,
  ): Promise<void> {
    // For high-value operations, require additional verification
    const mfaToken = request.headers['x-mfa-token'];
    if (!mfaToken) {
      throw new UnauthorizedException(
        'Multi-factor authentication required for this operation',
      );
    }

    // Verify MFA token (mock implementation)
    if (!(await this.verifyMfaToken(user.id, mfaToken))) {
      throw new UnauthorizedException(
        'Invalid multi-factor authentication token',
      );
    }

    // Check for recent security incidents
    if (await this.hasRecentSecurityIncidents(user.id)) {
      throw new ForbiddenException(
        'Account flagged for recent security incidents',
      );
    }
  }

  private async verifyMfaToken(
    userId: string,
    token: string,
  ): Promise<boolean> {
    // Mock MFA verification - implement with actual MFA service
    return token === 'valid-mfa-token';
  }

  private async hasRecentSecurityIncidents(userId: string): Promise<boolean> {
    // Check for recent failed login attempts, password changes, etc.
    // Mock implementation
    return false;
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for'] ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }
}
