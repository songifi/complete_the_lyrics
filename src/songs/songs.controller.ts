import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { SongsService } from "./songs.service";
import { CreateSongDto, UpdateSongDto, BulkImportDto, QuerySongsDto } from "./songs.dto";

@Controller("songs")
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post()
  create(@Body() dto: CreateSongDto) {
    return this.songsService.create(dto);
  }

  @Get()
  findAll(@Query() query: QuerySongsDto) {
    return this.songsService.findAll(query);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.songsService.findOne(id);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateSongDto) {
    return this.songsService.update(id, dto);
  }

  @Delete(":id")
  remove(@Param("id") id: string) {
    return this.songsService.remove(id);
  }

  @Post("bulk-import")
  bulkImport(@Body() dto: BulkImportDto) {
    return this.songsService.bulkImport(dto);
  }

  @Get("recommendations/for-user/:userId")
  recommendForUser(@Param("userId") userId: string, @Query("limit") limit?: number) {
    return this.songsService.recommendForUser(userId, Number(limit) || 10);
  }
}


