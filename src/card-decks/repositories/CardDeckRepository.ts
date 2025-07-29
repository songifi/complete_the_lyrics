import { EntityRepository, Repository } from 'typeorm';
import { CardDeck } from '../entities/CardDeck';

@EntityRepository(CardDeck)
export class CardDeckRepository extends Repository<CardDeck> {
  async findByCategory(category: string): Promise<CardDeck[]> {
    return this.manager.createQueryBuilder(CardDeck, 'deck')
      .where("deck.metadata->>'categories' LIKE :category", { category: `%${category}%` })
      .getMany();
  }

  async findByTheme(theme: string): Promise<CardDeck[]> {
    return this.manager.createQueryBuilder(CardDeck, 'deck')
      .where("deck.metadata->>'theme' = :theme", { theme })
      .getMany();
  }

  async findPopularDecks(limit: number = 10): Promise<CardDeck[]> {
    // Example: sort by usage in metadata.analytics.usage
    return this.manager.createQueryBuilder(CardDeck, 'deck')
      .orderBy("deck.metadata->'analytics'->>'usage'", 'DESC')
      .limit(limit)
      .getMany();
  }
}
