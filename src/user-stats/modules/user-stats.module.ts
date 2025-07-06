import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserStats } from '../entities/user-stats.entity';
import { UserStatsService } from '../services/user-stats.service';
import { UserStatsController } from '../controllers/user-stats.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserStats])],
  providers: [UserStatsService],
  controllers: [UserStatsController],
  exports: [UserStatsService], // Export to use in other modules
})
export class UserStatsModule {}