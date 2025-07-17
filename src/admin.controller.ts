import { Controller, Get, Query, UseGuards, Header } from '@nestjs/common';
import { UsersService } from './users/users.service';
import { AttemptsService } from './attempts/attempts.service';
import { UserStatsService } from './user-stats/services/user-stats.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CurrentUser } from './auth/current-user.decorator';
import { User } from './users/entities/user.entity';
import { Parser as CsvParser } from 'json2csv';

function isAdmin(user: User) {
  return user.role === 'admin';
}

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly attemptsService: AttemptsService,
    private readonly userStatsService: UserStatsService,
  ) {}

  @Get('export/stats')
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="export.csv"')
  async exportStats(
    @CurrentUser() user: User,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('category') category?: string,
  ): Promise<string> {
    if (!isAdmin(user)) {
      throw new Error('Forbidden: Admins only');
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const statsResult = await this.userStatsService.getStatsForExport({
      userId,
      from,
      to,
      category,
    });
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const attemptsResult = await this.attemptsService.getAttemptsForExport({
      userId,
      from,
      to,
      category,
    });
    const stats: Record<string, unknown>[] =
      Array.isArray(statsResult) &&
      statsResult.every((item) => typeof item === 'object' && item !== null)
        ? (statsResult as unknown as Record<string, unknown>[])
        : [];
    const attempts: Record<string, unknown>[] =
      Array.isArray(attemptsResult) &&
      attemptsResult.every((item) => typeof item === 'object' && item !== null)
        ? (attemptsResult as unknown as Record<string, unknown>[])
        : [];
    const data: Record<string, unknown>[] = [...stats, ...attempts];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    const csvParser = new CsvParser();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
    if (typeof csvParser.parse === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return
      return csvParser.parse(data);
    }
    return '';
  }
}
