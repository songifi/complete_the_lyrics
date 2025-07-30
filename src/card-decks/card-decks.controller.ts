import { Controller, Post, Body, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { DeckGenerationService } from './card-decks.service';
import { CreateDeckDto } from './dto/CreateDeckDto';
import { DeckShareGuard } from './guards/deck-share.guard';

@ApiTags('card-decks')
@Controller('card-decks')
export class CardDecksController {
  constructor(private readonly deckService: DeckGenerationService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate a deck with difficulty and categories' })
  @ApiResponse({ status: 201, description: 'Deck generated successfully.' })
  async generateDeck(
    @Body('difficulty') difficulty: string,
    @Body('categories') categories: string[],
    @Body('version') version: string,
  ) {
    return this.deckService.generateDeck(difficulty, categories, version);
  }

  @Post('custom')
  @ApiOperation({ summary: 'Create a custom deck' })
  @ApiResponse({ status: 201, description: 'Custom deck created.' })
  async createCustomDeck(
    @Body() dto: CreateDeckDto,
    @Body('songCardIds') songCardIds: string[],
  ) {
    return this.deckService.createCustomDeck(dto, songCardIds);
  }

  @Put(':deckId/share')
  @UseGuards(DeckShareGuard)
  @ApiOperation({ summary: 'Share a deck with a user' })
  @ApiParam({ name: 'deckId', type: String })
  @ApiQuery({ name: 'userId', type: String })
  async shareDeck(
    @Param('deckId') deckId: string,
    @Query('userId') userId: string,
  ) {
    return this.deckService.shareDeck(deckId, userId);
  }

  @Get(':deckId/analytics')
  @ApiOperation({ summary: 'Get deck performance analytics' })
  @ApiParam({ name: 'deckId', type: String })
  async getDeckAnalytics(@Param('deckId') deckId: string) {
    return this.deckService.getDeckAnalytics(deckId);
  }

  @Put(':deckId')
  @ApiOperation({ summary: 'Update a deck and bump version' })
  @ApiParam({ name: 'deckId', type: String })
  @ApiResponse({ status: 200, description: 'Deck updated.' })
  async updateDeck(
    @Param('deckId') deckId: string,
    @Body() updates: Partial<any>,
  ) {
    return this.deckService.updateDeck(deckId, updates);
  }
}
