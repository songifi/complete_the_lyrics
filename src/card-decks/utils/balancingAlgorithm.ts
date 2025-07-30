import { SongCard } from '../entities/SongCard';

export function balancingAlgorithm(cards: SongCard[], difficulty: string, categories: string[]): SongCard[] {
  // Example: filter by difficulty and categories, then shuffle
  let filtered = cards.filter(card => card.difficulty === difficulty && categories.some(cat => card.metadata?.categories?.includes(cat)));
  // Shuffle
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }
  return filtered.slice(0, 20); // Return up to 20 cards
}
