import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AUTH_CONSTANTS } from '../constants/auth.constants';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private emailProvider: any = null;
  private isInitialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.initializeEmailProvider();
    this.isInitialized = true;
    this.logger.log('EmailService initialized successfully');
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async waitForReady(timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (!this.isReady()) {
      if (Date.now() - startTime > timeout) {
        throw new Error('EmailService initialization timeout');
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Escapes HTML special characters to prevent XSS attacks
   * @param text - The text to escape
   * @returns HTML-escaped text safe for interpolation
   */
  private escapeHtml(text: string): string {
    if (!text) return '';
    
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitizes username to prevent XSS attacks
   * @param username - The raw username input
   * @returns Sanitized username safe for HTML interpolation
   */
  private sanitizeUsername(username: string | null | undefined): string {
    if (!username) {
      return 'User';
    }
    
    const escaped = this.escapeHtml(username);
    
    if (!escaped || escaped.trim() === '') {
      return 'User';
    }
    
    return escaped.trim();
  }

  private async initializeEmailProvider() {
    try {
      const emailService = this.configService.get('EMAIL_SERVICE');
      
      if (emailService === 'nodemailer') {
        try {
          const nodemailer = await import('nodemailer');
          this.emailProvider = nodemailer.createTransport({
            host: this.configService.get('SMTP_HOST'),
            port: this.configService.get('SMTP_PORT'),
            secure: false,
            auth: {
              user: this.configService.get('SMTP_USER'),
              pass: this.configService.get('SMTP_PASS'),
            },
          });
          this.logger.log('Nodemailer email provider initialized successfully');
        } catch (error) {
          this.logger.warn('Nodemailer package not installed. Run: npm install nodemailer');
        }
      }
      
      if (!this.emailProvider) {
        this.logger.warn('No email provider configured. Emails will only be logged.');
      }
    } catch (error) {
      this.logger.error('Failed to initialize email provider:', error);
    }
  }

  async sendVerificationEmail(email: string, token: string, username: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('EmailService is not yet initialized');
    }

    try {
      const verificationUrl = `${this.configService.get('FRONTEND_URL')}/verify-email?token=${token}`;
      const emailContent = this.generateVerificationEmail(verificationUrl, username);
      
      if (this.emailProvider) {
        if (this.configService.get('EMAIL_SERVICE') === 'nodemailer') {
          await this.emailProvider.sendMail({
            to: email,
            from: this.configService.get('SMTP_USER'),
            subject: 'Verify Your Email Address',
            html: emailContent,
          });
        }
        this.logger.log(`Verification email sent to ${email}`);
      } else {
        this.logger.log(`[EMAIL LOG] Verification email would be sent to ${email}`);
        this.logger.debug(`Verification URL: ${verificationUrl}`);
        this.logger.debug(`Email Content: ${emailContent}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${email}:`, error);
      throw new Error('Failed to send verification email');
    }
  }

  async sendPasswordResetEmail(email: string, token: string, username: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('EmailService is not yet initialized');
    }

    try {
      const resetUrl = `${this.configService.get('FRONTEND_URL')}/reset-password?token=${token}`;
      const emailContent = this.generatePasswordResetEmail(resetUrl, username);
      
      if (this.emailProvider) {
        if (this.configService.get('EMAIL_SERVICE') === 'nodemailer') {
          await this.emailProvider.sendMail({
            to: email,
            from: this.configService.get('SMTP_USER'),
            subject: 'Reset Your Password',
            html: emailContent,
          });
        }
        this.logger.log(`Password reset email sent to ${email}`);
      } else {
        this.logger.log(`[EMAIL LOG] Password reset email would be sent to ${email}`);
        this.logger.debug(`Reset URL: ${resetUrl}`);
        this.logger.debug(`Email Content: ${emailContent}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to send password reset email to ${email}:`, error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendWelcomeEmail(email: string, username: string): Promise<void> {
    if (!this.isReady()) {
      throw new Error('EmailService is not yet initialized');
    }

    try {
      const emailContent = this.generateWelcomeEmail(username);
      
      if (this.emailProvider) {
        if (this.configService.get('EMAIL_SERVICE') === 'nodemailer') {
          await this.emailProvider.sendMail({
            to: email,
            from: this.configService.get('SMTP_USER'),
            subject: 'Welcome to Our Platform!',
            html: emailContent,
          });
        }
        this.logger.log(`Welcome email sent to ${email}`);
      } else {
        this.logger.log(`[EMAIL LOG] Welcome email would be sent to ${email}`);
        this.logger.debug(`Email Content: ${emailContent}`);
      }
      
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${email}:`, error);
      // Don't throw error for welcome email as it's not critical
    }
  }

  isEmailServiceConfigured(): boolean {
    if (!this.isReady()) {
      return false;
    }
    return !!this.emailProvider;
  }

  getEmailProviderStatus(): string {
    if (!this.isReady()) {
      return 'EmailService is not yet initialized';
    }
    if (this.emailProvider) {
      return `Configured with ${this.configService.get('EMAIL_SERVICE') || 'unknown'} provider`;
    }
    return 'No email provider configured - emails will only be logged';
  }

  private generateVerificationEmail(verificationUrl: string, username: string): string {
    const safeUsername = this.sanitizeUsername(username);
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Verify Your Email Address</title>
        </head>
        <body>
          <h2>Hello ${safeUsername}!</h2>
          <p>Thank you for registering with Complete The Lyrics. Please verify your email address by clicking the link below:</p>
          <p><a href="${verificationUrl}">Verify Email Address</a></p>
          <p>If you didn't create an account, please ignore this email.</p>
          <p>This link will expire in 24 hours.</p>
          <p>Best regards,<br>Complete The Lyrics</p>
        </body>
      </html>
    `;
  }

  private generatePasswordResetEmail(resetUrl: string, username: string): string {
    const safeUsername = this.sanitizeUsername(username);
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Reset Your Password</title>
        </head>
        <body>
          <h2>Hello ${safeUsername}!</h2>
          <p>You requested a password reset. Please click the link below to reset your password:</p>
          <p><a href="${resetUrl}">Reset Password</a></p>
          <p>If you didn't request a password reset, please ignore this email.</p>
          <p>This link will expire in 1 hour.</p>
          <p>Best regards,<br>Complete The Lyrics</p>
        </body>
      </html>
    `;
  }

  private generateWelcomeEmail(username: string): string {
    const safeUsername = this.sanitizeUsername(username);
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Complete The Lyrics</title>
        </head>
        <body>
          <h2>Welcome ${safeUsername}!</h2>
          <p>Thank you for verifying your email address. Your account is now active!</p>
          <p>You can now log in and start using Complete The Lyrics.</p>
          <p>If you have any questions, feel free to contact our support team.</p>
          <p>Best regards,<br>Complete The Lyrics</p>
        </body>
      </html>
    `;
  }
}
