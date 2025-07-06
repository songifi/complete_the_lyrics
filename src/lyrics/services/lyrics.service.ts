import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Lyrics } from '../entities/lyrics.entity';
import { CreateLyricsDto } from '../dto/create-lyrics.dto';
import { UpdateLyricsDto } from '../dto/update-lyrics.dto';

@Injectable()
export class LyricsService {
  constructor(
    @InjectRepository(Lyrics)
    private readonly lyricsRepository: Repository<Lyrics>,
  ) {}

  async createLyrics(dto: CreateLyricsDto): Promise<Lyrics> {
    const lyric = this.lyricsRepository.create(dto);
    return this.lyricsRepository.save(lyric);
  }

  async getAllLyrics(): Promise<Lyrics[]> {
    return this.lyricsRepository.find();
  }

  async getLyricsById(id: number): Promise<Lyrics> {
    const lyric = await this.lyricsRepository.findOne({ where: { id } });
    if (!lyric) throw new NotFoundException('Lyric not found');
    return lyric;
  }

  async updateLyrics(id: number, dto: UpdateLyricsDto): Promise<Lyrics> {
    const lyric = await this.getLyricsById(id);
    Object.assign(lyric, dto);
    return this.lyricsRepository.save(lyric);
  }

  async deleteLyrics(id: number): Promise<void> {
    const result = await this.lyricsRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Lyric not found');
  }

  async getRandomLyric(filter: {
    category?: string;
    difficulty?: string;
  }): Promise<Partial<Lyrics>> {
    const qb = this.lyricsRepository.createQueryBuilder('lyrics');
    if (filter.category)
      qb.andWhere('lyrics.category = :category', { category: filter.category });
    if (filter.difficulty)
      qb.andWhere('lyrics.difficulty = :difficulty', {
        difficulty: filter.difficulty,
      });
    const count = await qb.getCount();
    if (count === 0) throw new NotFoundException('No lyrics found for filter');
    const randomOffset = Math.floor(Math.random() * count);
    const lyric = await qb.skip(randomOffset).take(1).getOne();
    if (!lyric) throw new NotFoundException('No lyric found');
    const { correctCompletion, ...rest } = lyric;
    return rest;
  }
}
