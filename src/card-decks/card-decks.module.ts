import { Module } from '@nestjs/common';
import { CardDecksService } from './card-decks.service';
import { CardDecksController } from './card-decks.controller';

@Module({
  controllers: [CardDecksController],
  providers: [CardDecksService],
})
export class CardDecksModule {}
