import { EntityRepository, Repository } from 'typeorm';
import { SongCard } from '../entities/SongCard';

@EntityRepository(SongCard)
export class SongCardRepository extends Repository<SongCard> {
  // Advanced querying methods can be added here
}
