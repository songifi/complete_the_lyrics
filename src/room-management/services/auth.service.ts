import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthenticatedUser } from '../interfaces';
import { JwtPayload, RoomJwtPayload } from '../strategies/jwt.strategy';

// This would typically come from a user service or database
export interface UserEntity {
  id: string;
  username: string;
  email: string;
  password: string;
  role?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate user credentials
   * In a real application, this would query a user database
   */
  async validateUser(username: string, password: string): Promise<AuthenticatedUser | null> {
    try {
      // This is a mock implementation
      // In a real app, you would:
      // 1. Query the user from database by username/email
      // 2. Compare the provided password with the stored hash
      // 3. Return the user if valid, null if not

      const mockUser = await this.getMockUser(username);

      if (!mockUser || !mockUser.isActive) {
        return null;
      }

      const isPasswordValid = await bcrypt.compare(password, mockUser.password);

      if (!isPasswordValid) {
        return null;
      }

      return {
        id: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
        role: mockUser.role,
      };
    } catch (error) {
      this.logger.error('Error validating user:', error);
      return null;
    }
  }

  /**
   * Generate a standard JWT token for user authentication
   */
  async generateToken(user: AuthenticatedUser): Promise<string> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN', '24h'),
    });
  }

  /**
   * Generate a room-specific JWT token
   */
  async generateRoomToken(
    user: AuthenticatedUser,
    roomId: string,
    roomRole?: string,
    roomPermissions?: string[],
  ): Promise<string> {
    const payload: RoomJwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      roomId,
      roomRole,
      roomPermissions,
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get('ROOM_JWT_EXPIRES_IN', '12h'),
    });
  }

  /**
   * Verify and decode a JWT token
   */
  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      return this.jwtService.verify(token);
    } catch (error) {
      this.logger.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Refresh a JWT token
   */
  async refreshToken(token: string): Promise<string | null> {
    try {
      const payload = this.jwtService.verify(token, { ignoreExpiration: true });

      // Create new token with fresh expiration
      const newPayload: JwtPayload = {
        sub: payload.sub,
        username: payload.username,
        email: payload.email,
        role: payload.role,
      };

      return this.jwtService.sign(newPayload, {
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '24h'),
      });
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Hash a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const saltRounds = this.configService.get('BCRYPT_SALT_ROUNDS', 12);
    return bcrypt.hash(password, saltRounds);
  }

  /**
   * Verify a password against a hash
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a secure random password
   */
  generateRandomPassword(length: number = 12): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';

    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password;
  }

  /**
   * Mock user for demonstration purposes
   * In a real application, this would be replaced with database queries
   */
  private async getMockUser(username: string): Promise<UserEntity | null> {
    // Mock users for testing
    const mockUsers: UserEntity[] = [
      {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 12), // pre-hashed password
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        username: 'admin',
        email: 'admin@example.com',
        password: await bcrypt.hash('admin123', 12),
        role: 'admin',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return mockUsers.find((user) => user.username === username || user.email === username) || null;
  }
}
