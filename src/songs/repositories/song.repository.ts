import { Injectable } from '@nestjs/common';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Song } from '../entities/song.entity';
import { SearchSongsDto } from '../dto/search-songs.dto';

@Injectable()
export class SongRepository {
  constructor(
    @InjectRepository(Song)
    private readonly repository: Repository<Song>,
  ) {}

  async create(songData: Partial<Song>): Promise<Song> {
    const song = this.repository.create(songData);
    return this.repository.save(song);
  }

  async findById(id: string): Promise<Song | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByIds(ids: string[]): Promise<Song[]> {
    return this.repository.findByIds(ids);
  }

  async update(id: string, updateData: Partial<Song>): Promise<Song> {
    await this.repository.update(id, updateData);
    return this.findById(id);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async searchWithFilters(searchDto: SearchSongsDto): Promise<{ songs: Song[]; total: number }> {
    const queryBuilder = this.createSearchQueryBuilder(searchDto);
    
    const [songs, total] = await queryBuilder
      .skip((searchDto.page - 1) * searchDto.limit)
      .take(searchDto.limit)
      .getManyAndCount();

    return { songs, total };
  }

  async findPopular(limit: number = 10): Promise<Song[]> {
    return this.repository
      .createQueryBuilder('song')
      .orderBy('song.playCount', 'DESC')
      .addOrderBy('song.rating', 'DESC')
      .limit(limit)
      .getMany();
  }

  async findRecentlyAdded(limit: number = 10): Promise<Song[]> {
    return this.repository
      .createQueryBuilder('song')
      .orderBy('song.createdAt', 'DESC')
      .limit(limit)
      .getMany();
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.repository.increment({ id }, 'playCount', 1);
  }

  async updateRating(id: string, newRating: number, currentRating: number, currentCount: number): Promise<void> {
    const totalRating = (currentRating * currentCount) + newRating;
    const newCount = currentCount + 1;
    const averageRating = totalRating / newCount;

    await this.repository.update(id, {
      rating: averageRating,
      ratingCount: newCount,
    });
  }

  private createSearchQueryBuilder(searchDto: SearchSongsDto): SelectQueryBuilder<Song> {
    const queryBuilder = this.repository.createQueryBuilder('song');

    if (searchDto.query) {
      queryBuilder.andWhere(
        '(MATCH(song.title) AGAINST(:query IN NATURAL LANGUAGE MODE) OR ' +
        'MATCH(song.artist) AGAINST(:query IN NATURAL LANGUAGE MODE) OR ' +
        'song.title LIKE :likeQuery OR ' +
        'song.artist LIKE :likeQuery OR ' +
        'song.album LIKE :likeQuery)',
        { 
          query: searchDto.query,
          likeQuery: `%${searchDto.query}%`
        }
      );
    }

    if (searchDto.genres && searchDto.genres.length > 0) {
      queryBuilder.andWhere('song.genre IN (:...genres)', { genres: searchDto.genres });
    }

    if (searchDto.artist) {
      queryBuilder.andWhere('song.artist LIKE :artist', { artist: `%${searchDto.artist}%` });
    }

    if (searchDto.yearFrom) {
      queryBuilder.andWhere('song.year >= :yearFrom', { yearFrom: searchDto.yearFrom });
    }

    if (searchDto.yearTo) {
      queryBuilder.andWhere('song.year <= :yearTo', { yearTo: searchDto.yearTo });
    }

    if (searchDto.difficulties && searchDto.difficulties.length > 0) {
      queryBuilder.andWhere('song.difficulty IN (:...difficulties)', { difficulties: searchDto.difficulties });
    }

    if (searchDto.tags && searchDto.tags.length > 0) {
      searchDto.tags.forEach((tag, index) => {
        queryBuilder.andWhere(`FIND_IN_SET(:tag${index}, song.tags) > 0`, { [`tag${index}`]: tag });
      });
    }

    if (searchDto.minRating) {
      queryBuilder.andWhere('song.rating >= :minRating', { minRating: searchDto.minRating });
    }

    queryBuilder.andWhere('song.isActive = :isActive', { isActive: true });

    // Sorting
    if (searchDto.sortBy) {
      queryBuilder.orderBy(`song.${searchDto.sortBy}`, searchDto.sortOrder);
    }

    return queryBuilder;
  }
}
