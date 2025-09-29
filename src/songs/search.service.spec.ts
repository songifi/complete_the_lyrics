import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchService } from './search.service';
import { CacheService } from './cache.service';
import { Song } from '../GameRound/entities/song.entity';
import { SearchAnalytics } from './entities/search-analytics.entity';
import { SearchSuggestion } from './entities/search-suggestion.entity';
import { SearchSortBy } from './search.dto';

describe('SearchService', () => {
  let service: SearchService;
  let songsRepo: Repository<Song>;
  let analyticsRepo: Repository<SearchAnalytics>;
  let suggestionRepo: Repository<SearchSuggestion>;
  let cacheService: CacheService;

  const mockSong: Partial<Song> = {
    id: '1',
    title: 'Test Song',
    artist: 'Test Artist',
    album: 'Test Album',
    genre: 'Pop',
    releaseYear: 2023,
    durationSeconds: 180,
    lyrics: 'Test lyrics content',
    metadata: {
      popularity: 85,
      explicit: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSongs = [mockSong as Song];

  beforeEach(async () => {
    const mockSongsRepository = {
      find: jest.fn().mockResolvedValue(mockSongs),
      findOne: jest.fn().mockResolvedValue(mockSong),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([mockSongs, 1]),
        getMany: jest.fn().mockResolvedValue(mockSongs),
      }),
    };

    const mockAnalyticsRepository = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockSuggestionRepository = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockReturnValue({}),
      createQueryBuilder: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      }),
    };

    const mockCacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
      cleanup: jest.fn(),
      getSize: jest.fn().mockReturnValue(0),
      startCleanupInterval: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        {
          provide: getRepositoryToken(Song),
          useValue: mockSongsRepository,
        },
        {
          provide: getRepositoryToken(SearchAnalytics),
          useValue: mockAnalyticsRepository,
        },
        {
          provide: getRepositoryToken(SearchSuggestion),
          useValue: mockSuggestionRepository,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    songsRepo = module.get<Repository<Song>>(getRepositoryToken(Song));
    analyticsRepo = module.get<Repository<SearchAnalytics>>(getRepositoryToken(SearchAnalytics));
    suggestionRepo = module.get<Repository<SearchSuggestion>>(getRepositoryToken(SearchSuggestion));
    cacheService = module.get<CacheService>(CacheService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('advancedSearch', () => {
    it('should perform search with query', async () => {
      const searchDto = {
        query: 'test',
        page: 1,
        limit: 20,
        sortBy: SearchSortBy.RELEVANCE,
      };

      const result = await service.advancedSearch(searchDto);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.query).toBe('test');
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should return cached results when available', async () => {
      const searchDto = {
        query: 'cached test',
        page: 1,
        limit: 20,
      };

      const cachedResult = {
        data: [mockSong],
        total: 1,
        page: 1,
        limit: 20,
        query: 'cached test',
        sortBy: SearchSortBy.RELEVANCE,
        responseTime: 50,
        suggestions: [],
        analytics: { cached: false, searchId: 'test-id' },
      };

      (cacheService.get as jest.Mock).mockResolvedValue(cachedResult);

      const result = await service.advancedSearch(searchDto);

      expect(result.analytics.cached).toBe(true);
      expect(cacheService.get).toHaveBeenCalled();
    });

    it('should track search analytics', async () => {
      const searchDto = {
        query: 'analytics test',
        page: 1,
        limit: 20,
      };

      await service.advancedSearch(searchDto, 'user-123');

      expect(analyticsRepo.create).toHaveBeenCalled();
      expect(analyticsRepo.save).toHaveBeenCalled();
    });
  });

  describe('fuzzySearch', () => {
    it('should perform fuzzy search', async () => {
      const result = await service.fuzzySearch('test', 0.6);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getSuggestions', () => {
    it('should return suggestions for query', async () => {
      const suggestionDto = {
        query: 'test',
        limit: 5,
      };

      const result = await service.getSuggestions(suggestionDto);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty array for short queries', async () => {
      const suggestionDto = {
        query: 'a',
        limit: 5,
      };

      const result = await service.getSuggestions(suggestionDto);

      expect(result).toEqual([]);
    });
  });

  describe('trackSearchAnalytics', () => {
    it('should track search analytics', async () => {
      const analyticsDto = {
        userId: 'user-123',
        query: 'test query',
        resultCount: 5,
        responseTime: 100,
      };

      await service.trackSearchAnalytics(analyticsDto);

      expect(analyticsRepo.create).toHaveBeenCalled();
      expect(analyticsRepo.save).toHaveBeenCalled();
    });
  });

  describe('trackClick', () => {
    it('should track click events', async () => {
      await service.trackClick('user-123', 'search-456', 'song-789');

      expect(analyticsRepo.update).toHaveBeenCalledWith(
        { id: 'search-456' },
        { clicked: true, clickedSongId: 'song-789' }
      );
    });
  });
});
