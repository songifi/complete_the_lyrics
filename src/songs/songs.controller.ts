import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Version,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';
import { SearchSongsDto } from './dto/search-songs.dto';

@ApiTags('songs')
@Controller('songs')
@UseGuards(ThrottlerGuard)
export class SongsController {
    constructor(private readonly songsService: SongsService) { }

    @Post()
    @Version('1')
    @ApiOperation({ summary: 'Create a new song' })
}