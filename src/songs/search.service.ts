import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, In, Raw } from 'typeorm';
import { CacheService } from './cache.service';
import Fuse from 'fuse.js';
import * as stringSimilarity from 'string-similarity';
import { Song } from '../GameRound/entities/song.entity';
import { SearchAnalytics } from './entities/search-analytics.entity';
import { SearchSuggestion } from './entities/search-suggestion.entity';
import {
  AdvancedSearchDto,
  SearchResponseDto,
  SearchResultDto,
  SearchSuggestionDto,
  SearchAnalyticsDto,
  SearchSortBy,
  SearchFilterType,
} from './search.dto';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private readonly fuseOptions = {
    keys: [
      { name: 'title', weight: 0.4 },
      { name: 'artist', weight: 0.3 },
      { name: 'album', weight: 0.1 },
      { name: 'genre', weight: 0.1 },
      { name: 'lyrics', weight: 0.1 },
    ],
    threshold: 0.6,
    includeScore: true,
    includeMatches: true,
  };

  private fuse: Fuse<Song> | null = null;

  constructor(
    @InjectRepository(Song)
    private readonly songsRepo: Repository<Song>,
    @InjectRepository(SearchAnalytics)
    private readonly analyticsRepo: Repository<SearchAnalytics>,
    @InjectRepository(SearchSuggestion)
    private readonly suggestionRepo: Repository<SearchSuggestion>,
    private readonly cacheService: CacheService,
  ) {
    this.initializeFuse();
  }

  private async initializeFuse() {
    try {
      const songs = await this.songsRepo.find({
        select: ['id', 'title', 'artist', 'album', 'genre', 'lyrics', 'releaseYear', 'durationSeconds', 'coverImageUrl', 'audioUrl', 'metadata'],
      });
      this.fuse = new Fuse(songs, this.fuseOptions);
    } catch (error) {
      this.logger.error('Failed to initialize Fuse.js:', error);
    }
  }

  async advancedSearch(dto: AdvancedSearchDto, userId?: string): Promise<SearchResponseDto> {
    const startTime = Date.now();
    const searchId = this.generateSearchId();
    
    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(dto);
      const cachedResult = await this.cacheService.get<SearchResponseDto>(cacheKey);
      
      if (cachedResult) {
        await this.trackSearchAnalytics({
          userId,
          query: dto.query || '',
          resultCount: cachedResult.total,
          filters: JSON.stringify(dto.filters),
          sortBy: dto.sortBy,
          responseTime: Date.now() - startTime,
          searchId,
        });
        
        return {
          ...cachedResult,
          analytics: { cached: true, searchId },
          responseTime: Date.now() - startTime,
        };
      }

      // Perform search
      const results = await this.performSearch(dto);
      const responseTime = Date.now() - startTime;

      // Generate suggestions if enabled
      let suggestions: string[] = [];
      if (dto.enableSuggestions && dto.query) {
        suggestions = await this.generateSuggestions(dto.query);
      }

      // Build response
      const response: SearchResponseDto = {
        data: results.data,
        total: results.total,
        page: dto.page || 1,
        limit: dto.limit || 20,
        query: dto.query || '',
        filters: dto.filters,
        sortBy: dto.sortBy || SearchSortBy.RELEVANCE,
        responseTime,
        suggestions,
        analytics: { cached: false, searchId },
      };

      // Cache results
      await this.cacheService.set(cacheKey, response, 300000); // 5 minutes

      // Track analytics
      await this.trackSearchAnalytics({
        userId,
        query: dto.query || '',
        resultCount: results.total,
        filters: JSON.stringify(dto.filters),
        sortBy: dto.sortBy,
        responseTime,
        searchId,
      });

      return response;
    } catch (error) {
      this.logger.error('Search error:', error);
      throw error;
    }
  }

  private async performSearch(dto: AdvancedSearchDto): Promise<{ data: SearchResultDto[]; total: number }> {
    const queryBuilder = this.songsRepo.createQueryBuilder('song');

    // Apply search query
    if (dto.query) {
      const searchQuery = this.buildSearchQuery(dto.query);
      queryBuilder.where(searchQuery.where, searchQuery.parameters);

      // Add rank selection for ordering by relevance
      const rankSql = `ts_rank(
        to_tsvector('english', coalesce(song.title,'') || ' ' || coalesce(song.artist,'') || ' ' || coalesce(song.album,'') || ' ' || coalesce(song.genre,'') || ' ' || coalesce(song.lyrics,'')),
        plainto_tsquery('english', :tsQuery)
      )`;
      queryBuilder.addSelect(rankSql, 'rank');
      queryBuilder.orderBy('rank', 'DESC');
      queryBuilder.addOrderBy('song.createdAt', 'DESC');
    }

    // Apply filters
    if (dto.filters && dto.filters.length > 0) {
      dto.filters.forEach((filter, index) => {
        const condition = this.buildFilterCondition(filter, `filter_${index}`);
        queryBuilder.andWhere(condition.where, condition.parameters);
      });
    }

    // Apply sorting
    this.applySorting(queryBuilder, dto.sortBy || SearchSortBy.RELEVANCE);

    // Apply pagination
    const page = dto.page || 1;
    const limit = dto.limit || 20;
    const offset = (page - 1) * limit;
    queryBuilder.skip(offset).take(limit);

    // Execute query
    const [songs, total] = await queryBuilder.getManyAndCount();

    // Transform results
    const results = await this.transformSearchResults(songs, dto);

    // Apply relevance sorting client-side only when no DB rank is present
    if (dto.sortBy === SearchSortBy.RELEVANCE && !dto.query) {
      results.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    return { data: results, total };
  }

  private buildSearchQuery(query: string): { where: string; parameters: any } {
    const parameters: any = { tsQuery: query };
    const where = `to_tsvector('english', coalesce(song.title,'') || ' ' || coalesce(song.artist,'') || ' ' || coalesce(song.album,'') || ' ' || coalesce(song.genre,'') || ' ' || coalesce(song.lyrics,'')) @@ plainto_tsquery('english', :tsQuery)`;
    return { where, parameters };
  }

  private buildFilterCondition(filter: any, prefix: string): { where: string; parameters: any } {
    const parameters: any = {};

    switch (filter.type) {
      case SearchFilterType.GENRE:
        return {
          where: 'LOWER(song.genre) LIKE LOWER(:genre)',
          parameters: { genre: `%${filter.value}%` },
        };

      case SearchFilterType.ARTIST:
        return {
          where: 'LOWER(song.artist) LIKE LOWER(:artist)',
          parameters: { artist: `%${filter.value}%` },
        };

      case SearchFilterType.YEAR_RANGE:
        if (filter.operator === 'between') {
          return {
            where: 'song.releaseYear BETWEEN :yearFrom AND :yearTo',
            parameters: { yearFrom: filter.value.from, yearTo: filter.value.to },
          };
        }
        break;

      case SearchFilterType.DURATION_RANGE:
        if (filter.operator === 'between') {
          return {
            where: 'song.durationSeconds BETWEEN :durationFrom AND :durationTo',
            parameters: { durationFrom: filter.value.from, durationTo: filter.value.to },
          };
        }
        break;

      case SearchFilterType.EXPLICIT:
        return {
          where: 'song.metadata->>:explicit = :explicitValue',
          parameters: { explicit: 'explicit', explicitValue: filter.value },
        };

      default:
        return { where: '1=1', parameters: {} };
    }

    return { where: '1=1', parameters: {} };
  }

  private applySorting(queryBuilder: any, sortBy: SearchSortBy): void {
    switch (sortBy) {
      case SearchSortBy.POPULARITY:
        queryBuilder.addOrderBy("((song.metadata->>'popularity')::int)", "DESC", "NULLS LAST");
        queryBuilder.addOrderBy('song.createdAt', 'DESC');
        break;

      case SearchSortBy.DATE_ADDED:
        queryBuilder.orderBy('song.createdAt', 'DESC');
        break;

      case SearchSortBy.ALPHABETICAL:
        queryBuilder.orderBy('song.title', 'ASC');
        queryBuilder.addOrderBy('song.artist', 'ASC');
        break;

      case SearchSortBy.DURATION:
        queryBuilder.orderBy('song.durationSeconds', 'DESC');
        break;

      case SearchSortBy.RELEVANCE:
      default:
        break;
    }
  }

  private async transformSearchResults(songs: Song[], dto: AdvancedSearchDto): Promise<SearchResultDto[]> {
    return songs.map(song => {
      const result: SearchResultDto = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        genre: song.genre,
        releaseYear: song.releaseYear,
        durationSeconds: song.durationSeconds,
        coverImageUrl: song.coverImageUrl,
        audioUrl: song.audioUrl,
        popularity: song.metadata?.popularity,
        explicit: song.metadata?.explicit,
        matchedFields: this.getMatchedFields(song, dto.query || ''),
      };

      if (dto.includeLyrics && song.lyrics) {
        result.lyrics = song.lyrics;
      }

      // Calculate relevance score if query exists
      if (dto.query) {
        result.relevanceScore = this.calculateRelevanceScore(song, dto.query);
      }

      return result;
    });
  }

  private getMatchedFields(song: Song, query: string): string[] {
    const matchedFields: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (song.title.toLowerCase().includes(lowerQuery)) matchedFields.push('title');
    if (song.artist.toLowerCase().includes(lowerQuery)) matchedFields.push('artist');
    if (song.album?.toLowerCase().includes(lowerQuery)) matchedFields.push('album');
    if (song.genre?.toLowerCase().includes(lowerQuery)) matchedFields.push('genre');
    if (song.lyrics?.toLowerCase().includes(lowerQuery)) matchedFields.push('lyrics');

    return matchedFields;
  }

  private calculateRelevanceScore(song: Song, query: string): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Title match (highest weight)
    if (song.title.toLowerCase().includes(queryLower)) {
      score += 100;
      if (song.title.toLowerCase().startsWith(queryLower)) score += 50;
    }

    // Artist match
    if (song.artist.toLowerCase().includes(queryLower)) {
      score += 80;
      if (song.artist.toLowerCase().startsWith(queryLower)) score += 40;
    }

    // Album match
    if (song.album?.toLowerCase().includes(queryLower)) {
      score += 60;
    }

    // Genre match
    if (song.genre?.toLowerCase().includes(queryLower)) {
      score += 40;
    }

    // Lyrics match (lower weight)
    if (song.lyrics?.toLowerCase().includes(queryLower)) {
      score += 20;
    }

    // Popularity boost
    if (song.metadata?.popularity) {
      score += song.metadata.popularity * 0.1;
    }

    return Math.min(score, 100); // Cap at 100
  }

  async fuzzySearch(query: string, threshold: number = 0.6): Promise<SearchResultDto[]> {
    if (!this.fuse) {
      await this.initializeFuse();
    }

    if (!this.fuse) {
      return [];
    }

    const results = this.fuse.search(query);
    const filteredResults = results
      .filter(result => (result.score ?? 0) <= threshold)
      .map(result => ({
        id: result.item.id,
        title: result.item.title,
        artist: result.item.artist,
        album: result.item.album,
        genre: result.item.genre,
        releaseYear: result.item.releaseYear,
        durationSeconds: result.item.durationSeconds,
        coverImageUrl: result.item.coverImageUrl,
        audioUrl: result.item.audioUrl,
        popularity: result.item.metadata?.popularity,
        explicit: result.item.metadata?.explicit,
        relevanceScore: (1 - (result.score || 0)) * 100,
        matchedFields: result.matches?.map(match => match.key) || [],
      }));

    return filteredResults;
  }

  async getSuggestions(dto: SearchSuggestionDto): Promise<string[]> {
    if (!dto.query || dto.query.length < 2) {
      return [];
    }

    const cacheKey = `suggestions:${dto.query}:${dto.limit}`;
    const cached = await this.cacheService.get<string[]>(cacheKey);
    
    if (cached) {
      return cached;
    }

    const suggestions = await this.suggestionRepo
      .createQueryBuilder('suggestion')
      .where('LOWER(suggestion.query) LIKE LOWER(:query)', { query: `%${dto.query}%` })
      .orderBy('suggestion.popularity', 'DESC')
      .addOrderBy('suggestion.usageCount', 'DESC')
      .take(dto.limit || 5)
      .getMany();

    const result = suggestions.map(s => s.query);
    await this.cacheService.set(cacheKey, result, 600000); // 10 minutes

    return result;
  }

  async trackSearchAnalytics(dto: SearchAnalyticsDto): Promise<void> {
    try {
      const analytics = this.analyticsRepo.create({
        userId: dto.userId,
        query: dto.query,
        resultCount: dto.resultCount || 0,
        filters: dto.filters ? JSON.parse(dto.filters) : null,
        sortBy: dto.sortBy,
        responseTime: dto.responseTime || 0,
        clicked: dto.clicked || false,
        clickedSongId: dto.clickedSongId,
        metadata: {
          timestamp: new Date(),
          searchId: dto.searchId,
        },
      });

      await this.analyticsRepo.save(analytics);

      // Update suggestion popularity
      if (dto.query) {
        await this.updateSuggestionPopularity(dto.query);
      }
    } catch (error) {
      this.logger.error('Failed to track search analytics:', error);
    }
  }

  async trackClick(userId: string, searchId: string, songId: string): Promise<void> {
    try {
      await this.analyticsRepo.update(
        { metadata: Raw(alias => `${alias}->>'searchId' = :searchId`, { searchId }) },
        { clicked: true, clickedSongId: songId }
      );
    } catch (error) {
      this.logger.error('Failed to track click:', error);
    }
  }

  private async updateSuggestionPopularity(query: string): Promise<void> {
    const suggestion = await this.suggestionRepo.findOne({
      where: { query: query.toLowerCase() },
    });

    if (suggestion) {
      suggestion.usageCount += 1;
      suggestion.popularity = Math.min(suggestion.popularity + 1, 1000);
      suggestion.lastUsed = new Date();
      await this.suggestionRepo.save(suggestion);
    } else {
      const newSuggestion = this.suggestionRepo.create({
        query: query.toLowerCase(),
        usageCount: 1,
        popularity: 1,
        lastUsed: new Date(),
      });
      await this.suggestionRepo.save(newSuggestion);
    }
  }

  private buildCacheKey(dto: AdvancedSearchDto): string {
    const keyParts = [
      'search',
      dto.query || '',
      JSON.stringify(dto.filters || []),
      dto.sortBy || SearchSortBy.RELEVANCE,
      dto.page || 1,
      dto.limit || 20,
      dto.includeLyrics ? 'lyrics:1' : 'lyrics:0',
      dto.enableSuggestions ? 'sug:1' : 'sug:0',
      dto.fuzzyThreshold !== undefined ? `fz:${dto.fuzzyThreshold}` : 'fz:na',
    ];
    return keyParts.join(':');
  }

  private generateSearchId(): string {
    return `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateSuggestions(query: string): Promise<string[]> {
    // Generate suggestions based on popular queries and current query
    const suggestions = await this.getSuggestions({ query, limit: 3 });
    
    // Add some common variations
    const variations = [
      `${query} lyrics`,
      `${query} song`,
      `best ${query}`,
    ];

    return [...suggestions, ...variations].slice(0, 5);
  }

  async getPopularQueries(limit: number = 10): Promise<{ queries: string[] }> {
    try {
      const results = await this.suggestionRepo
        .createQueryBuilder('suggestion')
        .orderBy('suggestion.popularity', 'DESC')
        .addOrderBy('suggestion.usageCount', 'DESC')
        .take(limit)
        .getMany();

      return {
        queries: results.map(s => s.query),
      };
    } catch (error) {
      this.logger.error('Failed to get popular queries:', error);
      return { queries: [] };
    }
  }

  async getTrendingSearches(limit: number = 10): Promise<{ trends: string[] }> {
    try {
      // Get searches from the last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      const results = await this.analyticsRepo
        .createQueryBuilder('analytics')
        .select('analytics.query, COUNT(*) as count')
        .where('analytics.createdAt >= :oneDayAgo', { oneDayAgo })
        .groupBy('analytics.query')
        .orderBy('count', 'DESC')
        .take(limit)
        .getRawMany();

      return {
        trends: results.map(r => r.query),
      };
    } catch (error) {
      this.logger.error('Failed to get trending searches:', error);
      return { trends: [] };
    }
  }
}
