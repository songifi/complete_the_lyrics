import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { LyricsService } from '../services/lyrics.service';
import { CreateLyricsDto } from '../dto/create-lyrics.dto';
import { UpdateLyricsDto } from '../dto/update-lyrics.dto';

@Controller('lyrics')
export class LyricsController {
  constructor(private readonly lyricsService: LyricsService) {}

  @Post()
  create(@Body() dto: CreateLyricsDto) {
    return this.lyricsService.createLyrics(dto);
  }

  @Get()
  findAll() {
    return this.lyricsService.getAllLyrics();
  }

  @Get('random')
  getRandom(
    @Query('category') category?: string,
    @Query('difficulty') difficulty?: string,
  ) {
    return this.lyricsService.getRandomLyric({ category, difficulty });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lyricsService.getLyricsById(Number(id));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLyricsDto) {
    return this.lyricsService.updateLyrics(Number(id), dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.lyricsService.deleteLyrics(Number(id));
  }
}
