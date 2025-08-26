import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserSearchDto } from './dto/user-search.dto';
import { UserResponseDto } from './dto/user-response.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully', type: UserResponseDto })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async create(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users with optional filtering and pagination' })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  async findAll(@Query() searchDto: UserSearchDto) {
    return this.usersService.findAll(searchDto);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get user statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics() {
    return this.usersService.getStatistics();
  }

  @Get('recent')
  @ApiOperation({ summary: 'Get recently active users' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days (default: 30)' })
  async getRecentlyActive(@Query('days', new ParseIntPipe({ optional: true })) days?: number) {
    return this.usersService.getRecentlyActiveUsers(days);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update user' })
  @ApiResponse({ status: 200, description: 'User updated successfully', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'User not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.usersService.update(id, updateUserDto);
  }

  @Patch(':id/lock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Lock user account' })
  @ApiResponse({ status: 200, description: 'User locked successfully' })
  async lockUser(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.lockUser(id);
  }

  @Patch(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unlock user account' })
  @ApiResponse({ status: 200, description: 'User unlocked successfully' })
  async unlockUser(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.unlockUser(id);
  }

  @Patch(':id/verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify user email' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  async verifyEmail(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.verifyEmail(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user permanently' })
  @ApiResponse({ status: 204, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete user (deactivate)' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  async softRemove(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.softRemove(id);
  }
}