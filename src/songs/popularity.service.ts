import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Song } from '../GameRound/entities/song.entity';
import { SearchAnalytics } from './entities/search-analytics.entity';

export interface PopularityMetrics {
  playCount: number;
  searchCount: number;
  clickThroughRate: number;
  userEngagement: number;
  recencyBoost: number;
}

@Injectable()
export class PopularityService {
  private readonly logger = new Logger(PopularityService.name);

  constructor(
    @InjectRepository(Song)
    private readonly songsRepo: Repository<Song>,
    @InjectRepository(SearchAnalytics)
    private readonly analyticsRepo: Repository<SearchAnalytics>,
  ) {}

  async calculatePopularityScore(songId: string): Promise<number> {
    try {
      const metrics = await this.getPopularityMetrics(songId);
      
      // Weighted scoring algorithm
      const score = 
        (metrics.playCount * 0.3) +
        (metrics.searchCount * 0.2) +
        (metrics.clickThroughRate * 100 * 0.2) +
        (metrics.userEngagement * 0.2) +
        (metrics.recencyBoost * 0.1);

      // Normalize to 0-100 scale
      return Math.min(Math.max(score, 0), 100);
    } catch (error) {
      this.logger.error(`Failed to calculate popularity score for song ${songId}:`, error);
      return 0;
    }
  }

  private async getPopularityMetrics(songId: string): Promise<PopularityMetrics> {
    // Load song and bail out if missing to avoid undefined dereferences
    const song = await this.songsRepo.findOne({ where: { id: songId } });
    if (!song) {
      this.logger.warn(`Song ${songId} not found while computing popularity metrics`);
      throw new Error('Song not found');
    }

    const metadata = song.metadata || {} as any;

    const playCount = typeof metadata.playCount === 'number' ? metadata.playCount : 0;
    const searchCount = typeof metadata.searchCount === 'number' ? metadata.searchCount : 0;
    const clickCount = typeof metadata.clickCount === 'number' ? metadata.clickCount : 0;
    const clickThroughRate = searchCount > 0 ? clickCount / searchCount : 0;

    // Calculate user engagement and recency boost using the validated song
    const userEngagement = this.calculateUserEngagement(song);
    const recencyBoost = this.calculateRecencyBoost(song);

    return {
      playCount,
      searchCount,
      clickThroughRate,
      userEngagement,
      recencyBoost,
    };
  }

  private calculateUserEngagement(song: Song): number {
    // Base engagement on various factors
    let engagement = 0;

    // Lyrics completeness
    if (song.lyrics && song.lyrics.length > 100) {
      engagement += 0.3;
    }

    // Metadata completeness
    if (song.album) engagement += 0.1;
    if (song.genre) engagement += 0.1;
    if (song.coverImageUrl) engagement += 0.1;
    if (song.audioUrl) engagement += 0.1;

    // Duration (longer songs might be more engaging)
    if (song.durationSeconds && song.durationSeconds > 180) {
      engagement += 0.1;
    }

    // Release year recency
    if (song.releaseYear) {
      const currentYear = new Date().getFullYear();
      const yearDiff = currentYear - song.releaseYear;
      if (yearDiff <= 5) {
        engagement += 0.2;
      } else if (yearDiff <= 10) {
        engagement += 0.1;
      }
    }

    return Math.min(engagement, 1);
  }

  private calculateRecencyBoost(song: Song): number {
    const now = new Date();
    const createdAt = song.createdAt;
    const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    // Boost for recently added songs
    if (daysSinceCreation <= 7) {
      return 1.0;
    } else if (daysSinceCreation <= 30) {
      return 0.8;
    } else if (daysSinceCreation <= 90) {
      return 0.6;
    } else if (daysSinceCreation <= 365) {
      return 0.4;
    } else {
      return 0.2;
    }
  }

  async updatePopularityScore(songId: string): Promise<void> {
    try {
      const score = await this.calculatePopularityScore(songId);
      
      await this.songsRepo.update(songId, {
        metadata: () => `coalesce(metadata, '{}'::jsonb) || '{"popularity": ${score}}'::jsonb`,
      });

      this.logger.log(`Updated popularity score for song ${songId}: ${score}`);
    } catch (error) {
      this.logger.error(`Failed to update popularity score for song ${songId}:`, error);
    }
  }

  async batchUpdatePopularityScores(songIds: string[]): Promise<void> {
    try {
      for (const songId of songIds) {
        await this.updatePopularityScore(songId);
      }
    } catch (error) {
      this.logger.error('Failed to batch update popularity scores:', error);
    }
  }

  async getTrendingSongs(limit: number = 10): Promise<Song[]> {
    try {
      return await this.songsRepo
        .createQueryBuilder('song')
        .orderBy("(song.metadata->>'popularity')::int", 'DESC', 'NULLS LAST')
        .addOrderBy('song.createdAt', 'DESC')
        .take(limit)
        .getMany();
    } catch (error) {
      this.logger.error('Failed to get trending songs:', error);
      return [];
    }
  }

  async getMostSearchedSongs(limit: number = 10): Promise<Song[]> {
    try {
      const results = await this.analyticsRepo
        .createQueryBuilder('analytics')
        .select('analytics.clickedSongId AS clicked_song_id')
        .addSelect('COUNT(*) AS click_count')
        .where('analytics.clickedSongId IS NOT NULL')
        .groupBy('analytics.clickedSongId')
        .orderBy('click_count', 'DESC')
        .take(limit)
        .getRawMany();

      const songIds = results.map(r => r.clicked_song_id);
      
      if (songIds.length === 0) {
        return [];
      }

      // Preserve the aggregated order when fetching Song rows
      const orderCase = `CASE ${songIds
        .map((id, idx) => `WHEN song.id = :id_${idx} THEN ${idx}`)
        .join(' ')} ELSE ${songIds.length} END`;

      const qb = this.songsRepo
        .createQueryBuilder('song')
        .where('song.id IN (:...ids)', { ids: songIds })
        .orderBy(orderCase, 'ASC');

      songIds.forEach((id, idx) => {
        qb.setParameter(`id_${idx}`, id);
      });

      return await qb.getMany();
    } catch (error) {
      this.logger.error('Failed to get most searched songs:', error);
      return [];
    }
  }

  async recordSongInteraction(songId: string, interactionType: 'play' | 'search' | 'click'): Promise<void> {
    try {
      const song = await this.songsRepo.findOne({ where: { id: songId } });
      if (!song) {
        this.logger.warn(`Song ${songId} not found for interaction tracking`);
        return;
      }

      const metadata = song.metadata || {};
      
      switch (interactionType) {
        case 'play':
          metadata.playCount = (metadata.playCount || 0) + 1;
          break;
        case 'search':
          metadata.searchCount = (metadata.searchCount || 0) + 1;
          break;
        case 'click':
          metadata.clickCount = (metadata.clickCount || 0) + 1;
          break;
      }

      metadata.lastInteraction = new Date().toISOString();

      await this.songsRepo.update(songId, { metadata });

      // Update popularity score
      await this.updatePopularityScore(songId);
    } catch (error) {
      this.logger.error(`Failed to record ${interactionType} interaction for song ${songId}:`, error);
    }
  }
}
