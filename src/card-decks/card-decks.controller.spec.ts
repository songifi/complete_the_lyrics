import { Test, TestingModule } from '@nestjs/testing';
import { CardDecksController } from './card-decks.controller';
import { CardDecksService } from './card-decks.service';

describe('CardDecksController', () => {
  let controller: CardDecksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CardDecksController],
      providers: [CardDecksService],
    }).compile();

    controller = module.get<CardDecksController>(CardDecksController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
