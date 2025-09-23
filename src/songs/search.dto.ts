import { IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min, ValidateNested, ValidateIf, ArrayMinSize, ArrayMaxSize, registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum SearchFilterType {
  GENRE = 'genre',
  ARTIST = 'artist',
  YEAR_RANGE = 'yearRange',
  DURATION_RANGE = 'durationRange',
  EXPLICIT = 'explicit',
}

// Allowed operators per filter type
const ALLOWED_OPERATORS = {
  [SearchFilterType.GENRE]: ['eq', 'like'],
  [SearchFilterType.ARTIST]: ['eq', 'like'],
  [SearchFilterType.YEAR_RANGE]: ['eq', 'gt', 'lt', 'gte', 'lte', 'between', 'in'],
  [SearchFilterType.DURATION_RANGE]: ['eq', 'gt', 'lt', 'gte', 'lte', 'between', 'in'],
  [SearchFilterType.EXPLICIT]: ['eq'],
} as const;

// Shared validator function for performance optimization
const validateSearchFilter = (value: any): boolean => {
  // Verify the incoming value is a plain object
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  // Check that type is one of the SearchFilterType enum values
  if (!Object.values(SearchFilterType).includes(value.type)) {
    return false;
  }

  // Normalize operator with safe check
  const op = value.operator ?? null;
  
  // Validate operator against allowed set for this type
  if (op !== null && !ALLOWED_OPERATORS[value.type].includes(op)) {
    return false;
  }

  // Type-specific validation
  switch (value.type) {
    case SearchFilterType.GENRE:
    case SearchFilterType.ARTIST:
      return typeof value.value === 'string' && value.value.trim().length > 0;

    case SearchFilterType.YEAR_RANGE:
    case SearchFilterType.DURATION_RANGE:
      if (op === 'between') {
        return Array.isArray(value.value) && 
               value.value.length === 2 && 
               value.value.every(v => Number.isInteger(v));
      }
      if (op === 'in') {
        return Array.isArray(value.value) && 
               value.value.length > 0 && 
               value.value.every(v => Number.isInteger(v));
      }
      return Number.isInteger(value.value);

    case SearchFilterType.EXPLICIT:
      return typeof value.value === 'boolean';

    default:
      return false;
  }
};

// Create the validator decorator
export function IsValidSearchFilter(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isValidSearchFilter',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return validateSearchFilter(value);
        },
        defaultMessage(args: ValidationArguments) {
          return 'Invalid search filter format';
        },
      },
    });
  };
}

export enum SearchSortBy {
  RELEVANCE = 'relevance',
  POPULARITY = 'popularity',
  DATE_ADDED = 'dateAdded',
  ALPHABETICAL = 'alphabetical',
  DURATION = 'duration',
}

// Base class for all filter DTOs
export abstract class BaseSearchFilterDto {
  @IsEnum(SearchFilterType)
  type: SearchFilterType;
}

// String field filter (genre, artist)
export class StringSearchFilterDto extends BaseSearchFilterDto {
  @IsEnum(SearchFilterType)
  type: SearchFilterType.GENRE | SearchFilterType.ARTIST;

  @IsString()
  @IsNotEmpty()
  value: string;

  @IsOptional()
  @IsIn(['eq','like'])
  operator?: 'eq' | 'like' = 'eq';
}

// Numeric field filter (year, duration)
export class NumericSearchFilterDto extends BaseSearchFilterDto {
  @IsEnum(SearchFilterType)
  type: SearchFilterType.YEAR_RANGE | SearchFilterType.DURATION_RANGE;

  @ValidateIf(o => o.operator === 'between', {
    message: 'Value must be a tuple of two numbers for between operator'
  })
  @IsArray()
  @ValidateIf(o => o.operator === 'between')
  @ArrayMinSize(2)
  @ValidateIf(o => o.operator === 'between')
  @ArrayMaxSize(2)
  @ValidateIf(o => o.operator === 'between')
  @IsInt({ each: true })
  @ValidateIf(o => o.operator === 'in', {
    message: 'Value must be an array of numbers for in operator'
  })
  @IsArray()
  @ValidateIf(o => o.operator === 'in')
  @IsInt({ each: true })
  @ValidateIf(o => o.operator && ['eq', 'gt', 'lt', 'gte', 'lte'].includes(o.operator), {
    message: 'Value must be a number for comparison operators'
  })
  @ValidateIf(o => o.operator && ['eq', 'gt', 'lt', 'gte', 'lte'].includes(o.operator))
  @IsNumber()
  @ValidateIf(o => o.operator && ['eq', 'gt', 'lt', 'gte', 'lte'].includes(o.operator))
  value: number | number[] | [number, number];

  @ValidateIf(o => o.operator !== undefined)
  @IsString()
  @IsIn(['eq', 'gt', 'lt', 'gte', 'lte', 'between', 'in'])
  operator?: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'between' | 'in' = 'eq';
}

// Boolean field filter (explicit)
export class BooleanSearchFilterDto extends BaseSearchFilterDto {
  @IsEnum(SearchFilterType)
  type: SearchFilterType.EXPLICIT;

  @IsBoolean()
  value: boolean;

  @IsOptional()
  @IsIn(['eq'])
  operator?: 'eq' = 'eq';
}

// Custom transform to resolve discriminated union to correct DTO class
function TransformToSearchFilterDto() {
  return Transform(({ value }) => {
    if (!Array.isArray(value)) {
      return value;
    }

    return value.map((item: any) => {
      if (!item || typeof item !== 'object' || !item.type) {
        return item;
      }

      // Transform based on discriminator field (type)
      switch (item.type) {
        case SearchFilterType.GENRE:
        case SearchFilterType.ARTIST:
          return Object.assign(new StringSearchFilterDto(), item);
        
        case SearchFilterType.YEAR_RANGE:
        case SearchFilterType.DURATION_RANGE:
          return Object.assign(new NumericSearchFilterDto(), item);
        
        case SearchFilterType.EXPLICIT:
          return Object.assign(new BooleanSearchFilterDto(), item);
        
        default:
          return item;
      }
    });
  });
}

// Union type for all filter DTOs
export type SearchFilterDto = StringSearchFilterDto | NumericSearchFilterDto | BooleanSearchFilterDto;

export class YearRangeDto {
  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(2030)
  from?: number;

  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(2030)
  to?: number;
}

export class DurationRangeDto {
  @IsInt()
  @IsOptional()
  @Min(0)
  from?: number; // seconds

  @IsInt()
  @IsOptional()
  @Min(0)
  to?: number; // seconds
}

export class AdvancedSearchDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsArray()
  @IsOptional()
  @IsValidSearchFilter({ each: true })
  @TransformToSearchFilterDto()
  filters?: SearchFilterDto[];

  @IsEnum(SearchSortBy)
  @IsOptional()
  sortBy?: SearchSortBy = SearchSortBy.RELEVANCE;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @IsBoolean()
  @IsOptional()
  includeLyrics?: boolean = false;

  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  @IsOptional()
  fuzzyThreshold?: number = 0.6;

  @IsBoolean()
  @IsOptional()
  enableSuggestions?: boolean = false;
}

export class SearchSuggestionDto {
  @IsString()
  @IsOptional()
  query?: string;

  @IsInt()
  @Type(() => Number)
  @Min(1)
  @Max(20)
  @IsOptional()
  limit?: number = 5;
}

export class FuzzySearchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  query: string;

  @IsNumber({ allowNaN: false }, { message: 'Threshold must be a valid number' })
  @Type(() => Number)
  @Min(0, { message: 'Threshold must be at least 0' })
  @Max(1, { message: 'Threshold must be at most 1' })
  @IsOptional()
  threshold?: number;
}

export class SearchAnalyticsDto {
  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  query: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  resultCount?: number;

  @IsString()
  @IsOptional()
  filters?: string;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsInt()
  @Type(() => Number)
  @IsOptional()
  responseTime?: number; // milliseconds

  @IsBoolean()
  @IsOptional()
  clicked?: boolean;

  @IsString()
  @IsOptional()
  clickedSongId?: string;

  @IsString()
  @IsOptional()
  searchId?: string;
}

export class SearchResultDto {
  id: string;
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  releaseYear?: number;
  durationSeconds?: number;
  coverImageUrl?: string;
  audioUrl?: string;
  popularity?: number;
  explicit?: boolean;
  relevanceScore?: number;
  lyrics?: string;
  matchedFields?: string[];
}

export class SearchResponseDto {
  data: SearchResultDto[];
  total: number;
  page: number;
  limit: number;
  query: string;
  filters?: SearchFilterDto[];
  sortBy: SearchSortBy;
  responseTime: number;
  suggestions?: string[];
  analytics: {
    cached: boolean;
    searchId: string;
  };
}
