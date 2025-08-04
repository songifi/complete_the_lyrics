import { Module, Global } from '@nestjs/common';
import { CardDecksModule } from './card-decks/card-decks.module';

@Global()
@Module({
  providers: [],
  exports: [],
  imports: [CardDecksModule],
})
export class APMModule {} 