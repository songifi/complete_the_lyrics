import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { LoginDto } from '../users/dto/login.dto';
import { JwtPayload } from './jwt.strategy';

export interface AuthResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    username: string;
    createdAt: Date;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    // Validate user credentials
    const user = await this.usersService.login(loginDto);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Create JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      username: user.username,
    };

    // Generate JWT token
    const access_token = this.jwtService.sign(payload);

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
    };
  }

  async validateUser(payload: JwtPayload) {
    return await this.usersService.findById(payload.sub);
  }
}
