import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAccessGuard } from '../auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import {
  AdvancedSearchDto,
  SearchSuggestionDto,
  SearchAnalyticsDto,
  FuzzySearchDto,
} from './search.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('advanced')
  @HttpCode(HttpStatus.OK)
  async advancedSearch(
    @Body() dto: AdvancedSearchDto,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.searchService.advancedSearch(dto, userId);
  }

  @Get('suggestions')
  async getSuggestions(@Query() dto: SearchSuggestionDto) {
    return this.searchService.getSuggestions(dto);
  }

  @Post('fuzzy')
  @HttpCode(HttpStatus.OK)
  async fuzzySearch(
    @Body() dto: FuzzySearchDto,
  ) {
    return this.searchService.fuzzySearch(dto.query, dto.threshold);
  }

  @Post('analytics')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.CREATED)
  async trackSearchAnalytics(
    @Body() dto: SearchAnalyticsDto,
    @Request() req: any,
  ) {
    dto.userId = req.user?.id;
    return this.searchService.trackSearchAnalytics(dto);
  }

  @Post('click/:searchId/:songId')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async trackClick(
    @Param('searchId') searchId: string,
    @Param('songId') songId: string,
    @Request() req: any,
  ) {
    const userId = req.user?.id;
    return this.searchService.trackClick(userId, searchId, songId);
  }

  @Get('popular-queries')
  async getPopularQueries(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    return this.searchService.getPopularQueries(limit);
  }

  @Get('trending')
  async getTrendingSearches(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number) {
    return this.searchService.getTrendingSearches(limit);
  }
}
