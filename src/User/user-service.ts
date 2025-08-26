import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { UserRepository } from './user-repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserSearchDto } from './dto/user-search.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './user.entity';
import { UserStatistics, PaginatedUsers } from './interfaces/user-statistic.interface';
import { plainToClass } from 'class-transformer';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async create(createUserDto: CreateUserDto): Promise<UserResponseDto> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmailOrUsername(
      createUserDto.email || createUserDto.username
    );

    if (existingUser) {
      if (existingUser.email === createUserDto.email.toLowerCase()) {
        throw new ConflictException('User with this email already exists');
      }
      if (existingUser.username === createUserDto.username) {
        throw new ConflictException('User with this username already exists');
      }
    }

    const user = await this.userRepository.create(createUserDto);
    return plainToClass(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  async findAll(searchDto: UserSearchDto): Promise<PaginatedUsers> {
    return this.userRepository.search(searchDto);
  }

  async findOne(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return plainToClass(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userRepository.findByUsername(username);
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedUser = await this.userRepository.update(id, updateUserDto);
    return plainToClass(UserResponseDto, updatedUser, { excludeExtraneousValues: true });
  }

  async remove(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const deleted = await this.userRepository.delete(id);
    if (!deleted) {
      throw new BadRequestException('Failed to delete user');
    }
  }

  async softRemove(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.userRepository.update(id, { isActive: false });
    return plainToClass(UserResponseDto, updated, { excludeExtraneousValues: true });
  }

  async changePassword(id: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.userRepository.update(id, { password: newPassword });
  }

  async verifyEmail(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.update(id, {
      isEmailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return plainToClass(UserResponseDto, user, { excludeExtraneousValues: true });
  }

  async generateEmailVerificationToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.setEmailVerificationToken(rawToken);
    user.emailVerificationExpires = expiresAt;
    await this.userRepository.update(userId, {
      emailVerificationToken: user.emailVerificationToken,
      emailVerificationExpires: user.emailVerificationExpires,
    });

    return rawToken;
  }

  async generatePasswordResetToken(email: string): Promise<string> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const rawToken = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    user.setPasswordResetToken(rawToken);
    user.passwordResetExpires = expiresAt;
    await this.userRepository.update(user.id, {
      passwordResetToken: user.passwordResetToken,
      passwordResetExpires: user.passwordResetExpires,
    });

    return rawToken;
  }

  async lockUser(id: string, duration: number = 2 * 60 * 60 * 1000): Promise<UserResponseDto> {
    const lockUntil = new Date(Date.now() + duration);
    const updatedUser = await this.userRepository.update(id, {
      isLocked: true,
      lockUntil,
    });

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return plainToClass(UserResponseDto, updatedUser, { excludeExtraneousValues: true });
  }

  async unlockUser(id: string): Promise<UserResponseDto> {
    const user = await this.userRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.resetLoginAttempts();
    const updatedUser = await this.userRepository.update(id, {
      isLocked: user.isLocked,
      lockUntil: user.lockUntil,
      loginAttempts: user.loginAttempts,
    });

    return plainToClass(UserResponseDto, updatedUser, { excludeExtraneousValues: true });
  }

  async updateLastLogin(id: string, ipAddress?: string): Promise<void> {
    await this.userRepository.update(id, {
      lastLoginAt: new Date(),
      lastLoginIp: ipAddress,
    });
  }

  async getStatistics(): Promise<UserStatistics> {
    return this.userRepository.getStatistics();
  }

  async bulkUpdateStatus(userIds: string[], isActive: boolean): Promise<number> {
    return this.userRepository.bulkUpdate(userIds, { isActive });
  }

  async getRecentlyActiveUsers(days: number = 30): Promise<UserResponseDto[]> {
    const users = await this.userRepository.findRecentlyActive(days);
    return users.map(user => plainToClass(UserResponseDto, user, { excludeExtraneousValues: true }));
  }
}