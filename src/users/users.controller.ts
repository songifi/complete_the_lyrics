import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { User } from './entities/user.entity';
import { UserResponseDto } from './interface/user.response';
import { plainToInstance } from 'class-transformer';
import { CurrentUser } from 'src/auth/current-user.decorator';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto): Promise<UserResponseDto> {
    const user = await this.usersService.register(registerDto);
    return plainToInstance(UserResponseDto, user);
  }
  
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getCurrentUser(
    @CurrentUser() user: User,
  ): Promise<UserResponseDto> {
    return plainToInstance(UserResponseDto, user);
  }

 
}
