import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateDeckDto } from './dto/CreateDeckDto';
import { Inject, UseGuards } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { DeckShareGuard } from './guards/deck-share.guard';
import { CardDeckRepository } from './repositories/CardDeckRepository';
import { SongCardRepository } from './repositories/SongCardRepository';
import { balancingAlgorithm } from './utils/balancingAlgorithm';
import { CardDeck } from './entities/CardDeck';

// ...existing code...

@Injectable()
export class DeckGenerationService {
  constructor(
    @InjectRepository(CardDeckRepository)
    private readonly cardDeckRepository: CardDeckRepository,
    @InjectRepository(SongCardRepository)
    private readonly songCardRepository: SongCardRepository,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async generateDeck(difficulty: string, categories: string[], version: string): Promise<CardDeck> {
    const songCards = await this.songCardRepository.find({ where: { difficulty } });
    const balancedCards = balancingAlgorithm(songCards, difficulty, categories);

    const cardDeck = new CardDeck();
    cardDeck.name = `Deck - ${difficulty}`;
    cardDeck.difficulty = difficulty;
    cardDeck.metadata = { categories };
    cardDeck.version = version;
    cardDeck.songCards = balancedCards;

    // Version control: Save with version
    return this.cardDeckRepository.save(cardDeck);
  }

  async createCustomDeck(dto: CreateDeckDto, songCardIds: string[]): Promise<CardDeck> {
    const songCards = await this.songCardRepository.findByIds(songCardIds);
    const cardDeck = new CardDeck();
    cardDeck.name = dto.name;
    cardDeck.difficulty = dto.difficulty;
    cardDeck.metadata = { categories: dto.categories, theme: dto.theme, ...dto.metadata };
    cardDeck.version = '1.0.0';
    cardDeck.songCards = songCards;
    return this.cardDeckRepository.save(cardDeck);
  }

  @UseGuards(DeckShareGuard)
  async shareDeck(deckId: string, userId: string): Promise<boolean> {
    // Custom guard checks permissions
    // Logic to share deck (e.g., generate share link, update permissions)
    return true;
  }

  async getDeckAnalytics(deckId: string): Promise<any> {
    // Try cache first
    const cached = await this.cacheManager.get(`deck-analytics-${deckId}`);
    if (cached) return cached;
    // Otherwise, calculate analytics (stub)
    const analytics = { usage: 0, winRate: 0 };
    await this.cacheManager.set(`deck-analytics-${deckId}`, analytics,  3600 );
    return analytics;
  }

  async updateDeck(deckId: string, updates: Partial<CardDeck>): Promise<CardDeck> {
    // Find deck, apply updates, increment version
    const deck = await this.cardDeckRepository.findOne({ where: { id: deckId } });
    if (!deck) throw new Error('Deck not found');
    Object.assign(deck, updates);
    deck.version = this.bumpVersion(deck.version);
    return this.cardDeckRepository.save(deck);
  }

  private bumpVersion(version: string): string {
    // Simple semver bump: 1.0.0 -> 1.0.1
    const parts = version.split('.').map(Number);
    parts[2]++;
    return parts.join('.');
  }
}
