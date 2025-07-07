import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttemptsController } from './attempts.controller';
import { AttemptsService } from './attempts.service';
import { Attempt } from './entities/attempt.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attempt])],
  controllers: [AttemptsController],
  providers: [AttemptsService],
})
export class AttemptsModule {}
