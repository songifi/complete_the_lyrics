import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpStatus,
  HttpCode,
  ParseIntPipe,
  ValidationPipe,
  UseInterceptors,
  ClassSerializerInterceptor,
  UsePipes,
} from "@nestjs/common"
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery, ApiBearerAuth, ApiBody } from "@nestjs/swagger"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { LocalAuthGuard } from "../auth/guards/local-auth.guard"
import type { UsersService } from "./users.service"
import type { AuthService } from "../auth/auth.service"
import {
  type CreateUserDto,
  type UpdateUserDto,
  LoginDto,
  type ChangePasswordDto,
  type ResetPasswordDto,
  type UpdateProfileDto,
  type UserSearchDto,
} from "./dto"
import { User } from "./entities/user.entity"

@ApiTags("users")
@Controller("users")
@UseInterceptors(ClassSerializerInterceptor)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  // Authentication Endpoints
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ValidationPipe())
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: User,
  })
  @ApiResponse({ status: 400, description: 'Bad request - validation failed' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    schema: {
      properties: {
        access_token: { type: 'string' },
        user: { $ref: '#/components/schemas/User' },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(@Request() req) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User logout' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  async logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }

  // CRUD Endpoints
  @Get()
  @ApiOperation({ summary: "Get all users with pagination" })
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: "Users retrieved successfully",
    schema: {
      properties: {
        data: { type: "array", items: { $ref: "#/components/schemas/User" } },
        total: { type: "number" },
        page: { type: "number" },
        limit: { type: "number" },
      },
    },
  })
  async findAll(@Query('page') page: number = 1, @Query('limit') limit: number = 10) {
    return this.usersService.findAll({
      page: Number(page),
      limit: Number(limit),
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: User,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Put(":id")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe())
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update user by ID" })
  @ApiParam({ name: "id", type: "number", description: "User ID" })
  @ApiResponse({
    status: 200,
    description: "User updated successfully",
    type: User,
  })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 403, description: "Forbidden - insufficient permissions" })
  async update(@Param('id', ParseIntPipe) id: number, @Body() updateUserDto: UpdateUserDto, @Request() req) {
    return this.usersService.update(id, updateUserDto, req.user)
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Delete user by ID" })
  @ApiParam({ name: "id", type: "number", description: "User ID" })
  @ApiResponse({ status: 204, description: "User deleted successfully" })
  @ApiResponse({ status: 404, description: "User not found" })
  @ApiResponse({ status: 403, description: "Forbidden - insufficient permissions" })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.usersService.remove(id, req.user)
  }

  // Profile Management Endpoints
  @Get('profile/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: User,
  })
  async getProfile(@Request() req) {
    return this.usersService.findOne(req.user.id);
  }

  @Put("profile/me")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe())
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
    type: User,
  })
  @ApiResponse({ status: 400, description: "Bad request - validation failed" })
  async updateProfile(@Body() updateProfileDto: UpdateProfileDto, @Request() req) {
    return this.usersService.updateProfile(req.user.id, updateProfileDto)
  }

  @Delete('profile/me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 204, description: 'Account deleted successfully' })
  async deleteAccount(@Request() req) {
    return this.usersService.remove(req.user.id, req.user);
  }

  // User Search and Discovery Endpoints
  @Get('search/users')
  @ApiOperation({ summary: 'Search users' })
  @ApiQuery({ name: 'q', required: true, type: String, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    schema: {
      properties: {
        data: { type: 'array', items: { $ref: '#/components/schemas/User' } },
        total: { type: 'number' },
        page: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  })
  async searchUsers(@Query() searchDto: UserSearchDto) {
    return this.usersService.searchUsers(searchDto);
  }

  @Get("discover/suggestions")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user suggestions for discovery" })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 5 })
  @ApiResponse({
    status: 200,
    description: "User suggestions retrieved",
    type: [User],
  })
  async getUserSuggestions(@Request() req, @Query('limit') limit: number = 5) {
    return this.usersService.getUserSuggestions(req.user.id, Number(limit))
  }

  @Get('discover/popular')
  @ApiOperation({ summary: 'Get popular users' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({
    status: 200,
    description: 'Popular users retrieved',
    type: [User],
  })
  async getPopularUsers(@Query('limit') limit: number = 10) {
    return this.usersService.getPopularUsers(Number(limit));
  }

  // User Statistics Endpoints
  @Get("stats/overview")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user statistics overview" })
  @ApiResponse({
    status: 200,
    description: "Statistics retrieved successfully",
    schema: {
      properties: {
        totalUsers: { type: "number" },
        activeUsers: { type: "number" },
        newUsersToday: { type: "number" },
        newUsersThisWeek: { type: "number" },
        newUsersThisMonth: { type: "number" },
      },
    },
  })
  async getStatisticsOverview() {
    return this.usersService.getStatisticsOverview()
  }

  @Get('stats/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get specific user statistics' })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID' })
  @ApiResponse({
    status: 200,
    description: 'User statistics retrieved',
    schema: {
      properties: {
        userId: { type: 'number' },
        profileViews: { type: 'number' },
        lastLoginAt: { type: 'string', format: 'date-time' },
        accountCreatedAt: { type: 'string', format: 'date-time' },
        totalPosts: { type: 'number' },
        totalFollowers: { type: 'number' },
        totalFollowing: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserStatistics(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.getUserStatistics(id);
  }

  @Get("stats/activity/:id")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get user activity statistics" })
  @ApiParam({ name: "id", type: "number", description: "User ID" })
  @ApiQuery({ name: "period", required: false, enum: ["week", "month", "year"], example: "month" })
  @ApiResponse({
    status: 200,
    description: "Activity statistics retrieved",
    schema: {
      properties: {
        period: { type: "string" },
        loginCount: { type: "number" },
        activityScore: { type: "number" },
        dailyActivity: { type: "array", items: { type: "object" } },
      },
    },
  })
  async getUserActivityStats(@Param('id', ParseIntPipe) id: number, @Query('period') period: string = 'month') {
    return this.usersService.getUserActivityStats(id, period)
  }

  // Password Management Endpoints
  @Put("password/change")
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe())
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Change user password" })
  @ApiResponse({ status: 200, description: "Password changed successfully" })
  @ApiResponse({ status: 400, description: "Invalid current password" })
  async changePassword(@Body() changePasswordDto: ChangePasswordDto, @Request() req) {
    return this.usersService.changePassword(req.user.id, changePasswordDto)
  }

  @Post('password/forgot')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset' })
  @ApiBody({
    schema: {
      properties: {
        email: { type: 'string', format: 'email' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password reset email sent' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async forgotPassword(@Body('email') email: string) {
    return this.usersService.forgotPassword(email);
  }

  @Post('password/reset')
  @UsePipes(new ValidationPipe())
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with token' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.usersService.resetPassword(resetPasswordDto);
  }

  @Post("password/validate")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Validate current password" })
  @ApiBody({
    schema: {
      properties: {
        password: { type: "string" },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Password is valid" })
  @ApiResponse({ status: 400, description: "Invalid password" })
  async validatePassword(@Body('password') password: string, @Request() req) {
    return this.usersService.validatePassword(req.user.id, password)
  }

  // Additional Utility Endpoints
  @Get('check/email/:email')
  @ApiOperation({ summary: 'Check if email is available' })
  @ApiParam({ name: 'email', type: 'string', description: 'Email to check' })
  @ApiResponse({
    status: 200,
    description: 'Email availability status',
    schema: {
      properties: {
        available: { type: 'boolean' },
        email: { type: 'string' },
      },
    },
  })
  async checkEmailAvailability(@Param('email') email: string) {
    return this.usersService.checkEmailAvailability(email);
  }

  @Get('check/username/:username')
  @ApiOperation({ summary: 'Check if username is available' })
  @ApiParam({ name: 'username', type: 'string', description: 'Username to check' })
  @ApiResponse({
    status: 200,
    description: 'Username availability status',
    schema: {
      properties: {
        available: { type: 'boolean' },
        username: { type: 'string' },
      },
    },
  })
  async checkUsernameAvailability(@Param('username') username: string) {
    return this.usersService.checkUsernameAvailability(username);
  }
}
