import { Module } from '@nestjs/common';
import { AttemptsController } from './attempts.controller';

@Module({
  controllers: [AttemptsController],
})
export class AttemptsModule {}
