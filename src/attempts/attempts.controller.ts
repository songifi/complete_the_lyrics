import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('attempts')
@UseGuards(JwtAuthGuard) // Protect all routes in this controller
export class AttemptsController {
  @Get()
  async getUserAttempts(@CurrentUser() user: User) {
    return {
      message: `Getting attempts for user: ${user.username}`,
      userId: user.id,
      attempts: [], // This would come from a service
    };
  }

  @Get('my-stats')
  async getMyStats(@CurrentUser('id') userId: string) {
    return {
      message: `Getting stats for user ID: ${userId}`,
      stats: {
        totalAttempts: 0,
        correctAttempts: 0,
        accuracy: 0,
      },
    };
  }

  @Post()
  async createAttempt(
    @CurrentUser() user: User,
    @Body() attemptData: any, // Replace with proper DTO
  ) {
    return {
      message: `Creating attempt for user: ${user.username}`,
      userId: user.id,
      attemptData,
    };
  }
}
