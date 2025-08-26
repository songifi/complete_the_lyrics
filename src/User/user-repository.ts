import { Repository, SelectQueryBuilder } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserSearchDto } from './dto/user-search.dto';
import { UserStatistics, PaginatedUsers } from './interfaces/user-statistic.interface'; //'../interfaces/user-statistics.interface';
import { UserResponseDto } from './dto/user-response.dto';
import { plainToClass } from 'class-transformer';

@Injectable()
export class UserRepository {
  constructor(
    @InjectRepository(User)
    private readonly repository: Repository<User>,
  ) {}

  async create(userData: Partial<User>): Promise<User> {
    const user = this.repository.create(userData);
    return this.repository.save(user);
  }

  async findById(id: string): Promise<User | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.findOne({ 
      where: { email: email.toLowerCase() },
      select: ['id', 'email', 'username', 'password', 'isActive', 'isLocked', 'loginAttempts', 'lockUntil']
    });
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.repository.findOne({ where: { username } });
  }

  async findByEmailOrUsername(identifier: string): Promise<User | null> {
    return this.repository.findOne({
      where: [
        { email: identifier.toLowerCase() },
        { username: identifier }
      ],
      select: ['id', 'email', 'username', 'password', 'isActive', 'isLocked', 'loginAttempts', 'lockUntil']
    });
  }

  async findByEmailVerificationToken(token: string): Promise<User | null> {
    return this.repository.findOne({
      where: { emailVerificationToken: token },
      select: ['id', 'email', 'emailVerificationToken', 'emailVerificationExpires', 'isEmailVerified']
    });
  }

  async findByPasswordResetToken(token: string): Promise<User | null> {
    return this.repository.findOne({
      where: { passwordResetToken: token },
      select: ['id', 'email', 'passwordResetToken', 'passwordResetExpires']
    });
  }

  async update(id: string, updateData: Partial<User>): Promise<User | null> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return result.affected > 0;
  }

  async softDelete(id: string): Promise<boolean> {
    const result = await this.repository.update(id, { isActive: false });
    return result.affected > 0;
  }

  async search(searchDto: UserSearchDto): Promise<PaginatedUsers> {
    const queryBuilder = this.createSearchQuery(searchDto);
    
    const [users, total] = await queryBuilder
      .limit(searchDto.limit)
      .offset(searchDto.offset)
      .getManyAndCount();

    const userDtos = users.map(user => plainToClass(UserResponseDto, user, {
      excludeExtraneousValues: true
    }));

    return {
      users: userDtos,
      total,
      limit: searchDto.limit,
      offset: searchDto.offset,
      hasNext: searchDto.offset + searchDto.limit < total,
      hasPrev: searchDto.offset > 0,
    };
  }

  private createSearchQuery(searchDto: UserSearchDto): SelectQueryBuilder<User> {
    let query = this.repository.createQueryBuilder('user');

    // Search by username or email
    if (searchDto.search) {
      query = query.where(
        '(LOWER(user.username) LIKE LOWER(:search) OR LOWER(user.email) LIKE LOWER(:search))',
        { search: `%${searchDto.search}%` }
      );
    }

    // Filter by email verification status
    if (searchDto.isEmailVerified !== undefined) {
      query = query.andWhere('user.isEmailVerified = :isEmailVerified', {
        isEmailVerified: searchDto.isEmailVerified,
      });
    }

    // Filter by active status
    if (searchDto.isActive !== undefined) {
      query = query.andWhere('user.isActive = :isActive', {
        isActive: searchDto.isActive,
      });
    }

    // Filter by locked status
    if (searchDto.isLocked !== undefined) {
      query = query.andWhere('user.isLocked = :isLocked', {
        isLocked: searchDto.isLocked,
      });
    }

    // Sorting
    query = query.orderBy(`user.${searchDto.sortBy}`, searchDto.sortOrder);

    return query;
  }

  async getStatistics(): Promise<UserStatistics> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [
      totalUsers,
      activeUsers,
      verifiedUsers,
      lockedUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      newUsersToday,
    ] = await Promise.all([
      this.repository.count(),
      this.repository.count({ where: { isActive: true } }),
      this.repository.count({ where: { isEmailVerified: true } }),
      this.repository.count({ where: { isLocked: true } }),
      this.repository.count({ where: { createdAt: { $gte: startOfMonth } } as any }),
      this.repository.count({ where: { createdAt: { $gte: startOfWeek } } as any }),
      this.repository.count({ where: { createdAt: { $gte: startOfDay } } as any }),
    ]);

    // Calculate average login frequency (simplified)
    const usersWithLogins = await this.repository
      .createQueryBuilder('user')
      .where('user.lastLoginAt IS NOT NULL')
      .getCount();

    const averageLoginFrequency = usersWithLogins > 0 ? usersWithLogins / totalUsers : 0;

    return {
      totalUsers,
      activeUsers,
      verifiedUsers,
      lockedUsers,
      newUsersThisMonth,
      newUsersThisWeek,
      newUsersToday,
      averageLoginFrequency,
    };
  }

  async findRecentlyActive(days: number = 30): Promise<User[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.repository.find({
      where: {
        lastLoginAt: { $gte: cutoffDate } as any,
        isActive: true,
      },
      order: { lastLoginAt: 'DESC' },
      take: 50,
    });
  }

  async bulkUpdate(userIds: string[], updateData: Partial<User>): Promise<number> {
    const result = await this.repository.update(userIds, updateData);
    return result.affected || 0;
  }

  async getUsersByDateRange(startDate: Date, endDate: Date): Promise<User[]> {
    return this.repository.find({
      where: {
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        } as any,
      },
      order: { createdAt: 'DESC' },
    });
  }
}