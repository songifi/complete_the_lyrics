import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { RegisterDto } from '../users/dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserResponseDto } from './interface/user.response';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async register(registerDto: RegisterDto): Promise<UserResponseDto> {
    const { email, username, password } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      throw new ConflictException('Email or username already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      email,
      username,
      password: hashedPassword,
      role: 'user', // Ensure default role
    });

    const savedUser = await this.userRepository.save(user);

    // Exclude password from response
    // const { password: _, ...result } = savedUser;
    return {
      id: savedUser.id,
      email: savedUser.email,
      username: savedUser.username,
      createdAt: savedUser.createdAt,
    };
  }

  async login(loginDto: LoginDto): Promise<Omit<User, 'password'>> {
    const { email, password } = loginDto;

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _, ...safeUser } = user;
    return safeUser;
  }

  async findById(id: string): Promise<Omit<User, 'password'> | null> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) return null;
    const { password: _, ...rest } = user;
    return rest;
  }

  // 🔍 Find user by email (include password if needed)
  async findByEmail(email: string): Promise<User | null> {
    return await this.userRepository.findOne({ where: { email } });
  }
}
