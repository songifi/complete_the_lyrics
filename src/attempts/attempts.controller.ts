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
