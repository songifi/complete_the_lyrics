import { Test, TestingModule } from '@nestjs/testing';
import { CardDecksService } from './card-decks.service';

describe('CardDecksService', () => {
  let service: CardDecksService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CardDecksService],
    }).compile();

    service = module.get<CardDecksService>(CardDecksService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
