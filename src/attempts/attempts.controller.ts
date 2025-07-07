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
import { Controller, Post, Get, Body, Query, Req, UseGuards } from '@nestjs/common';
import { SubmitAttemptDto } from './dto/submit-attempt.dto';
import { AttemptsService } from './attempts.service';

@Controller('attempts')
export class AttemptsController {
  constructor(private readonly attemptsService: AttemptsService) {}

  @Post()
  async submit(@Req() req, @Body() dto: SubmitAttemptDto) {
    const userId = req.user.id;
    const correctCompletion = 'this is the correct lyric text'; // Normally fetched from DB
    return this.attemptsService.submitAttempt(userId, dto, correctCompletion);
  }

  @Get('my')
  async getMyAttempts(@Req() req) {
    return this.attemptsService.getUserAttempts(req.user.id);
  }

  @Get()
  async getAll(
    @Query('userId') userId?: string,
    @Query('isCorrect') isCorrect?: string,
    @Query('skip') skip = '0',
    @Query('take') take = '20'
  ) {
    const isCorrectBool = isCorrect !== undefined ? isCorrect === 'true' : undefined;

    return this.attemptsService.getAllAttempts({
      userId,
      isCorrect: isCorrectBool,
      skip: Number(skip),
      take: Number(take),
    });
  }
}
