import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { EmailService } from './email.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
  ResendVerificationDto,
  ChangePasswordDto,
  UpdateProfileDto,
  AuthResponseDto,
} from '../dto/auth.dto';
import { AUTH_CONSTANTS, AUTH_ERRORS, AUTH_MESSAGES } from '../constants/auth.constants';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private emailService: EmailService,
    private configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto, ipAddress?: string): Promise<AuthResponseDto> {
    const { email, username, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      if (existingUser.email === email) {
        throw new ConflictException(AUTH_ERRORS.EMAIL_TAKEN);
      }
      throw new ConflictException(AUTH_ERRORS.USERNAME_TAKEN);
    }

    // Validate password strength
    this.validatePasswordStrength(password);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, AUTH_CONSTANTS.BCRYPT_ROUNDS);

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(
      Date.now() + AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRES_IN * 1000,
    );

    // Create user
    const user = this.userRepository.create({
      email,
      username,
      password: hashedPassword,
      firstName,
      lastName,
      emailVerificationToken,
      emailVerificationExpires,
      lastLoginIp: ipAddress,
    });

    await this.userRepository.save(user);

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(email, emailVerificationToken, username);
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`);
      // Don't fail registration if email fails
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    this.logger.log(`User registered successfully: ${email}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async login(loginDto: LoginDto, ipAddress?: string): Promise<AuthResponseDto> {
    const { identifier, password, rememberMe } = loginDto;

    // Find user by email or username
    const user = await this.userRepository.findOne({
      where: [
        { email: identifier },
        { username: identifier },
      ],
      select: ['id', 'email', 'username', 'firstName', 'lastName', 'isEmailVerified', 'password', 'loginAttempts', 'lockUntil', 'isLocked', 'lastLoginAt', 'lastLoginIp'],
    });

    if (!user) {
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    // Check if account is locked
    if (user.isLockedOut()) {
      throw new UnauthorizedException(AUTH_ERRORS.ACCOUNT_LOCKED);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      user.incrementLoginAttempts();
      await this.userRepository.save(user);
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_CREDENTIALS);
    }

    // Reset login attempts on successful login
    user.resetLoginAttempts();
    user.lastLoginAt = new Date();
    user.lastLoginIp = ipAddress;
    await this.userRepository.save(user);

    // Generate tokens
    const tokens = await this.generateTokens(user, rememberMe);

    this.logger.log(`User logged in successfully: ${user.email}`);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        isEmailVerified: user.isEmailVerified,
      },
    };
  }

  async refreshToken(refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    const { refreshToken } = refreshTokenDto;

    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET') || AUTH_CONSTANTS.JWT_REFRESH_SECRET,
      });

      // Compute token hash (HMAC-SHA256 with server-side secret/pepper)
      const refreshTokenPepper = this.configService.get('REFRESH_TOKEN_PEPPER') || AUTH_CONSTANTS.JWT_REFRESH_SECRET;
      const tokenHash = crypto
        .createHmac('sha256', refreshTokenPepper)
        .update(refreshToken)
        .digest('hex');

      // Check if token exists in database and is not revoked by hash
      const tokenEntity = await this.refreshTokenRepository.findOne({
        where: { tokenHash, isRevoked: false },
        relations: ['user'],
      });

      if (!tokenEntity || tokenEntity.isExpired()) {
        throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);
      }

      // Revoke old refresh token
      tokenEntity.revoke('refresh');
      await this.refreshTokenRepository.save(tokenEntity);

      // Generate new tokens
      const tokens = await this.generateTokens(tokenEntity.user);

      this.logger.log(`Token refreshed for user: ${tokenEntity.user.email}`);

      return {
        ...tokens,
        user: {
          id: tokenEntity.user.id,
          email: tokenEntity.user.email,
          username: tokenEntity.user.username,
          firstName: tokenEntity.user.firstName,
          lastName: tokenEntity.user.lastName,
          isEmailVerified: tokenEntity.user.isEmailVerified,
        },
      };
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new UnauthorizedException(AUTH_ERRORS.INVALID_TOKEN);
    }
  }

  async logout(userId: string, tokenId?: string): Promise<void> {
    if (tokenId) {
      // Revoke specific refresh token
      await this.refreshTokenRepository.update(
        { id: tokenId },
        { isRevoked: true, revokedAt: new Date(), revokedBy: 'logout' },
      );
    } else {
      // Revoke all refresh tokens for user
      await this.refreshTokenRepository.update(
        { userId },
        { isRevoked: true, revokedAt: new Date(), revokedBy: 'logout' },
      );
    }

    this.logger.log(`User logged out: ${userId}`);
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto): Promise<void> {
    const { email } = forgotPasswordDto;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate password reset token
    const passwordResetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetExpires = new Date(
      Date.now() + AUTH_CONSTANTS.PASSWORD_RESET_EXPIRES_IN * 1000,
    );

    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await this.userRepository.save(user);

    // Send password reset email
    try {
      await this.emailService.sendPasswordResetEmail(email, passwordResetToken, user.username);
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`);
      throw new Error('Failed to send password reset email');
    }

    this.logger.log(`Password reset requested for: ${email}`);
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<void> {
    const { token, newPassword } = resetPasswordDto;

    // Validate password strength
    this.validatePasswordStrength(newPassword);

    const user = await this.userRepository.findOne({
      where: { passwordResetToken: token },
      select: ['id', 'email', 'username', 'password', 'passwordResetToken', 'passwordResetExpires'],
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BadRequestException(AUTH_ERRORS.INVALID_TOKEN);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_ROUNDS);

    // Update user
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await this.userRepository.save(user);

    // Revoke all refresh tokens
    await this.refreshTokenRepository.update(
      { userId: user.id },
      { isRevoked: true, revokedAt: new Date(), revokedBy: 'password_reset' },
    );

    this.logger.log(`Password reset successful for: ${user.email}`);
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<void> {
    const { token } = verifyEmailDto;

    const user = await this.userRepository.findOne({
      where: { emailVerificationToken: token },
      select: ['id', 'email', 'username', 'emailVerificationToken', 'emailVerificationExpires'],
    });

    if (!user || !user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new BadRequestException(AUTH_ERRORS.INVALID_TOKEN);
    }

    // Verify email
    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await this.userRepository.save(user);

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail(user.email, user.username);
    } catch (error) {
      this.logger.error(`Failed to send welcome email: ${error.message}`);
    }

    this.logger.log(`Email verified for: ${user.email}`);
  }

  async resendVerification(resendVerificationDto: ResendVerificationDto): Promise<void> {
    const { email } = resendVerificationDto;

    const user = await this.userRepository.findOne({ 
      where: { email },
      select: ['id', 'email', 'username', 'isEmailVerified', 'emailVerificationToken', 'emailVerificationExpires'],
    });
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    if (user.isEmailVerified) {
      throw new BadRequestException('Email is already verified');
    }

    // Generate new verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(
      Date.now() + AUTH_CONSTANTS.EMAIL_VERIFICATION_EXPIRES_IN * 1000,
    );

    user.emailVerificationToken = emailVerificationToken;
    user.emailVerificationExpires = emailVerificationExpires;
    await this.userRepository.save(user);

    // Send verification email
    try {
      await this.emailService.sendVerificationEmail(email, emailVerificationToken, user.username);
    } catch (error) {
      this.logger.error(`Failed to send verification email: ${error.message}`);
      throw new Error('Failed to send verification email');
    }

    this.logger.log(`Verification email resent to: ${email}`);
  }

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto): Promise<void> {
    const { currentPassword, newPassword } = changePasswordDto;

    const user = await this.userRepository.findOne({ 
      where: { id: userId },
      select: ['id', 'password']
    });
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    // Validate new password strength
    this.validatePasswordStrength(newPassword);

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, AUTH_CONSTANTS.BCRYPT_ROUNDS);

    // Update password
    user.password = hashedPassword;
    await this.userRepository.save(user);

    // Revoke all refresh tokens
    await this.refreshTokenRepository.update(
      { userId },
      { isRevoked: true, revokedAt: new Date(), revokedBy: 'password_change' },
    );

    this.logger.log(`Password changed for user: ${userId}`);
  }

  async updateProfile(userId: string, updateProfileDto: UpdateProfileDto): Promise<void> {
    const { firstName, lastName, username } = updateProfileDto;

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await this.userRepository.findOne({ where: { username } });
      if (existingUser) {
        throw new ConflictException(AUTH_ERRORS.USERNAME_TAKEN);
      }
    }

    // Update profile
    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (username !== undefined) user.username = username;

    await this.userRepository.save(user);

    this.logger.log(`Profile updated for user: ${userId}`);
  }

  async getProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    const { password, emailVerificationToken, passwordResetToken, ...profile } = user;
    return profile;
  }

  isEmailServiceConfigured(): boolean {
    return this.emailService.isEmailServiceConfigured();
  }

  getEmailServiceStatus(): string {
    return this.emailService.getEmailProviderStatus();
  }

  async generateTokens(user: User, rememberMe = false): Promise<{
    accessToken: string;
    refreshToken: string;
    tokenType: string;
    expiresIn: number;
  }> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      roles: [], // Add roles if you implement role-based access control
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET') || AUTH_CONSTANTS.JWT_SECRET,
      expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshTokenPayload = {
      sub: user.id,
      tokenId: crypto.randomUUID(),
    };

    const refreshToken = this.jwtService.sign(refreshTokenPayload, {
      secret: this.configService.get('JWT_REFRESH_SECRET') || AUTH_CONSTANTS.JWT_REFRESH_SECRET,
      expiresIn: rememberMe
        ? AUTH_CONSTANTS.REMEMBER_ME_EXPIRES_IN
        : AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN,
    });

    // Compute hash for storage
    const refreshTokenPepper = this.configService.get('REFRESH_TOKEN_PEPPER') || AUTH_CONSTANTS.JWT_REFRESH_SECRET;
    const tokenHash = crypto
      .createHmac('sha256', refreshTokenPepper)
      .update(refreshToken)
      .digest('hex');

    const refreshTokenEntity = this.refreshTokenRepository.create({
      tokenHash,
      userId: user.id,
      expiresAt: new Date(
        Date.now() + (rememberMe
          ? AUTH_CONSTANTS.REMEMBER_ME_EXPIRES_IN
          : AUTH_CONSTANTS.REFRESH_TOKEN_EXPIRES_IN) * 1000,
      ),
    });

    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: AUTH_CONSTANTS.ACCESS_TOKEN_EXPIRES_IN,
    };
  }

  private validatePasswordStrength(password: string): void {
    if (password.length < AUTH_CONSTANTS.MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(AUTH_ERRORS.WEAK_PASSWORD);
    }

    if (!AUTH_CONSTANTS.PASSWORD_REGEX.test(password)) {
      throw new BadRequestException(
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
      );
    }
  }

  async findOrCreateOAuthUser(provider: string, profile: any): Promise<User> {
    this.logger.log(`Processing OAuth login for provider: ${provider}`);

    if (!profile.email) {
      throw new BadRequestException('Email is required for OAuth authentication');
    }

    // Check if user already exists with this OAuth provider
    const existingUser = await this.userRepository.findOne({
      where: {
        oauthProviders: {
          [provider]: { id: profile.providerId }
        }
      }
    });

    if (existingUser) {
      this.logger.log(`Found existing OAuth user for ${provider}: ${existingUser.email}`);
      return existingUser;
    }

    // Check if user exists with same email
    const userWithEmail = await this.userRepository.findOne({
      where: { email: profile.email }
    });

    if (userWithEmail) {
      // Link existing account with OAuth provider
      this.logger.log(`Linking existing account with ${provider} OAuth`);
      await this.linkOAuthAccount(userWithEmail.id, provider, profile);
      return userWithEmail;
    }

    // Create new user
    const newUser = this.userRepository.create({
      email: profile.email,
      username: profile.username || profile.email.split('@')[0],
      firstName: profile.firstName,
      lastName: profile.lastName,
      isEmailVerified: true, // OAuth users are pre-verified
      oauthProviders: {
        [provider]: {
          id: profile.providerId,
          email: profile.email,
          username: profile.username,
          linkedAt: new Date()
        }
      }
    });

    // Generate a random password for OAuth users
    const randomPassword = crypto.randomUUID();
    newUser.password = await bcrypt.hash(randomPassword, AUTH_CONSTANTS.BCRYPT_ROUNDS);
    
    const savedUser = await this.userRepository.save(newUser);
    this.logger.log(`Created new OAuth user for ${provider}: ${savedUser.email}`);
    
    return savedUser;
  }

  async linkOAuthAccount(userId: string, provider: string, profile: any): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    // Update or add OAuth provider info
    const currentProviders = user.oauthProviders || {};
    currentProviders[provider] = {
      id: profile.providerId,
      email: profile.email,
      username: profile.username,
      linkedAt: new Date()
    };

    await this.userRepository.update(userId, {
      oauthProviders: currentProviders
    });

    this.logger.log(`Linked ${provider} OAuth account to user: ${user.email}`);
  }

  async unlinkOAuthAccount(userId: string, provider: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    if (!user.oauthProviders?.[provider]) {
      throw new BadRequestException(`No ${provider} OAuth account linked to this user`);
    }

    // Check if user has a password set (to prevent account lockout)
    if (!user.password || user.password === '') {
      throw new BadRequestException('Cannot unlink OAuth account: user has no password set');
    }

    // Remove the OAuth provider
    const currentProviders = { ...user.oauthProviders };
    delete currentProviders[provider];

    await this.userRepository.update(userId, {
      oauthProviders: currentProviders
    });

    this.logger.log(`Unlinked ${provider} OAuth account from user: ${user.email}`);
  }

  async getLinkedOAuthAccounts(userId: string): Promise<Record<string, any>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    
    if (!user) {
      throw new NotFoundException(AUTH_ERRORS.USER_NOT_FOUND);
    }

    return user.oauthProviders || {};
  }
}
