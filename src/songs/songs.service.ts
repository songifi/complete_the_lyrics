import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SongRepository } from './repositories/song.repository';
import { DifficultyCalculatorService } from './services/difficulty-calculator.service';
import { Song } from './entities/song.entity';
import { SongMetadata, SongMetadataDocument } from './schemas/song-metadata.schema';
import { CreateSongDto } from './dto/create-song.dto';
import { SearchSongsDto } from './dto/search-songs.dto';

@Injectable()
export class SongsService {
  constructor(
    private readonly songRepository: SongRepository,
    private readonly difficultyCalculator: DifficultyCalculatorService,
    @InjectModel(SongMetadata.name)
    private readonly songMetadataModel: Model<SongMetadataDocument>,
  ) {}

  async create(createSongDto: CreateSongDto): Promise<Song> {
    const song = await this.songRepository.create({
      ...createSongDto,
      difficultyScore: 0, // Will be calculated later when metadata is added
    });

    // Initialize metadata document
    await this.songMetadataModel.create({
      songId: song.id,
      customFields: {},
      instruments: [],
      technicalData: {},
      performanceMetrics: {},
      versions: [],
      credits: {},
    });

    return song;
  }

  async findAll(searchDto: SearchSongsDto): Promise<{ songs: Song[]; total: number; page: number; totalPages: number }> {
    const { songs, total } = await this.songRepository.searchWithFilters(searchDto);
    const totalPages = Math.ceil(total / searchDto.limit);

    return {
      songs,
      total,
      page: searchDto.page,
      totalPages,
    };
  }

  async findOne(id: string): Promise<Song> {
    const song = await this.songRepository.findById(id);
    if (!song) {
      throw new NotFoundException(`Song with ID ${id} not found`);
    }
    return song;
  }

  async update(id: string, updateSongDto: Partial<CreateSongDto>): Promise<Song> {
    const existingSong = await this.findOne(id);
    return this.songRepository.update(id, updateSongDto);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id); // Check if exists
    await this.songRepository.delete(id);
    await this.songMetadataModel.deleteOne({ songId: id });
  }

  async updateMetadata(songId: string, metadata: Partial<SongMetadata>): Promise<SongMetadata> {
    const song = await this.findOne(songId);
    
    const updatedMetadata = await this.songMetadataModel.findOneAndUpdate(
      { songId },
      { $set: metadata },
      { new: true, upsert: true }
    );

    // Recalculate difficulty if technical data changed
    if (metadata.technicalData || metadata.performanceMetrics) {
      await this.recalculateDifficulty(songId);
    }

    return updatedMetadata;
  }

  async getMetadata(songId: string): Promise<SongMetadata> {
    const metadata = await this.songMetadataModel.findOne({ songId });
    if (!metadata) {
      throw new NotFoundException(`Metadata for song ${songId} not found`);
    }
    return metadata;
  }

  async incrementPlayCount(id: string): Promise<void> {
    await this.findOne(id); // Check if exists
    await this.songRepository.incrementPlayCount(id);
  }

  async rateSong(id: string, rating: number): Promise<Song> {
    const song = await this.findOne(id);
    await this.songRepository.updateRating(id, rating, song.rating, song.ratingCount);
    return this.findOne(id);
  }

  async getPopularSongs(limit: number = 10): Promise<Song[]> {
    return this.songRepository.findPopular(limit);
  }

  async getRecentSongs(limit: number = 10): Promise<Song[]> {
    return this.songRepository.findRecentlyAdded(limit);
  }

  async addTags(id: string, tags: string[]): Promise<Song> {
    const song = await this.findOne(id);
    const existingTags = song.tags || [];
    const newTags = [...new Set([...existingTags, ...tags])];
    
    return this.songRepository.update(id, { tags: newTags });
  }

  async removeTags(id: string, tags: string[]): Promise<Song> {
    const song = await this.findOne(id);
    const filteredTags = (song.tags || []).filter(tag => !tags.includes(tag));
    
    return this.songRepository.update(id, { tags: filteredTags });
  }

  private async recalculateDifficulty(songId: string): Promise<void> {
    const song = await this.findOne(songId);
    const metadata = await this.getMetadata(songId);

    const difficultyScore = this.difficultyCalculator.calculateDifficultyScore({
      bpm: metadata.technicalData?.bpm,
      key: metadata.technicalData?.key,
      timeSignature: metadata.technicalData?.timeSignature,
      complexity: metadata.performanceMetrics?.complexity,
      rhythmComplexity: metadata.performanceMetrics?.rhythmComplexity,
      harmonicComplexity: metadata.performanceMetrics?.harmonicComplexity,
      melodicComplexity: metadata.performanceMetrics?.melodicComplexity,
      duration: song.duration,
      genre: song.genre,
    });

    const difficultyLevel = this.difficultyCalculator.getDifficultyLevel(difficultyScore);

    await this.songRepository.update(songId, {
      difficultyScore,
      difficulty: difficultyLevel,
    });
  }
}
