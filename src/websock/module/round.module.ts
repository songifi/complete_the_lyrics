import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoundService } from './round.service';
import { RoundController } from './round.controller';
import { RoundGateway } from './round.gateway';
import { Round } from './entities/round.entity';
import { PlayerAnswer } from './entities/player-answer.entity';
import { BuzzIn } from './entities/buzz-in.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Round, PlayerAnswer, BuzzIn]),
  ],
  controllers: [RoundController],
  providers: [RoundService, RoundGateway],
  exports: [RoundService],
})
export class RoundModule {}

// Example usage in app.module.ts
/*
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoundModule } from './round/round.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'your_username',
      password: 'your_password',
      database: 'your_database',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // Don't use in production
    }),
    RoundModule,
  ],
})
export class AppModule {}
