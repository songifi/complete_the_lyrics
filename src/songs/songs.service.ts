import { Injectable, BadRequestException, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, ILike } from "typeorm";
import { Song } from "../GameRound/entities/song.entity";
import { BulkImportDto, CreateSongDto, QuerySongsDto, UpdateSongDto } from "./songs.dto";
import { computeLyricsHash, isLyricsGameCompatible, normalizeText, parseAndValidateLyrics } from "./lyrics.util";

@Injectable()
export class SongsService {
  constructor(
    @InjectRepository(Song)
    private readonly songsRepo: Repository<Song>,
  ) {}

  // Duplicate detection helpers
  private buildFingerprint(title: string, artist: string): string {
    const key = `${normalizeText(title)}::${normalizeText(artist)}`;
    return key;
  }

  private async findDuplicate(title: string, artist: string, lyrics?: string): Promise<Song | null> {
    const fingerprint = this.buildFingerprint(title, artist);
    const lyricsHash = computeLyricsHash(lyrics || undefined);

    const qb = this.songsRepo.createQueryBuilder("song");
    qb.where("LOWER(TRIM(song.title)) = LOWER(TRIM(:title))", { title })
      .andWhere("LOWER(TRIM(song.artist)) = LOWER(TRIM(:artist))", { artist });

    const candidates = await qb.limit(10).getMany();
    for (const s of candidates) {
      const candidateFp = this.buildFingerprint(s.title, s.artist);
      if (candidateFp === fingerprint) return s;
      if (lyricsHash && s.lyrics && computeLyricsHash(s.lyrics) === lyricsHash) return s;
    }
    return null;
  }

  // CRUD
  async create(dto: CreateSongDto): Promise<Song> {
    const duplicate = await this.findDuplicate(dto.title, dto.artist, dto.lyrics);
    if (duplicate) {
      throw new BadRequestException("Duplicate song detected");
    }

    const parsed = parseAndValidateLyrics(dto.lyrics);
    if (!isLyricsGameCompatible(parsed)) {
      throw new BadRequestException("Lyrics not compatible for game");
    }

    const metadata = this.enrichMetadata(dto);
    const song = this.songsRepo.create({ ...dto, metadata });
    return this.songsRepo.save(song);
  }

  async findAll(query: QuerySongsDto): Promise<{ data: Song[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const where: any = {};
    if (query.artist) where.artist = ILike(`%${query.artist}%`);
    if (query.genre) where.genre = ILike(`%${query.genre}%`);

    const qb = this.songsRepo.createQueryBuilder("song").where(where);
    if (query.q) {
      qb.andWhere("(LOWER(song.title) LIKE LOWER(:q) OR LOWER(song.artist) LIKE LOWER(:q))", { q: `%${query.q}%` });
    }
    qb.orderBy("song.createdAt", "DESC").skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Song> {
    const song = await this.songsRepo.findOne({ where: { id } });
    if (!song) throw new NotFoundException("Song not found");
    return song;
  }

  async update(id: string, dto: UpdateSongDto): Promise<Song> {
    const song = await this.findOne(id);

    if ((dto.title && dto.title !== song.title) || (dto.artist && dto.artist !== song.artist) || (dto.lyrics && dto.lyrics !== song.lyrics)) {
      const duplicate = await this.findDuplicate(dto.title || song.title, dto.artist || song.artist, dto.lyrics || song.lyrics);
      if (duplicate && duplicate.id !== id) {
        throw new BadRequestException("Duplicate song detected");
      }
    }

    if (dto.lyrics !== undefined) {
      const parsed = parseAndValidateLyrics(dto.lyrics);
      if (!isLyricsGameCompatible(parsed)) {
        throw new BadRequestException("Lyrics not compatible for game");
      }
    }

    const metadata = this.enrichMetadata({ ...song, ...dto });
    Object.assign(song, dto, { metadata });
    return this.songsRepo.save(song);
  }

  async remove(id: string): Promise<{ id: string }> {
    const song = await this.findOne(id);
    await this.songsRepo.remove(song);
    return { id };
  }

  // Bulk import
  async bulkImport(dto: BulkImportDto): Promise<{ inserted: number; updated: number; skipped: number }> {
    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const item of dto.items) {
      const parsed = parseAndValidateLyrics(item.lyrics);
      if (!isLyricsGameCompatible(parsed)) {
        skipped++;
        continue;
      }
      const existing = await this.findDuplicate(item.title, item.artist, item.lyrics);
      if (existing) {
        if (dto.upsert) {
          const metadata = this.enrichMetadata({ ...existing, ...item });
          Object.assign(existing, item, { metadata });
          await this.songsRepo.save(existing);
          updated++;
        } else {
          skipped++;
        }
      } else {
        const metadata = this.enrichMetadata(item);
        const entity = this.songsRepo.create({ ...item, metadata });
        await this.songsRepo.save(entity);
        inserted++;
      }
    }

    return { inserted, updated, skipped };
  }

  // Recommendations (simple rule-based)
  async recommendForUser(userId: string, limit: number = 10): Promise<Song[]> {
    // Placeholder: fallback to popular, recent, diverse genres
    const qb = this.songsRepo.createQueryBuilder("song");
    qb.orderBy("(song.metadata->>'popularity')::int NULLS LAST", "DESC")
      .addOrderBy("song.createdAt", "DESC")
      .take(limit);
    const songs = await qb.getMany();
    return this.diversifyByGenre(songs, limit);
  }

  private diversifyByGenre(songs: Song[], limit: number): Song[] {
    const result: Song[] = [];
    const seenGenres = new Set<string>();
    for (const s of songs) {
      const g = (s.genre || "").toLowerCase();
      if (!seenGenres.has(g)) {
        result.push(s);
        seenGenres.add(g);
      }
      if (result.length >= limit) break;
    }
    if (result.length < limit) {
      for (const s of songs) {
        if (!result.find(r => r.id === s.id)) result.push(s);
        if (result.length >= limit) break;
      }
    }
    return result;
  }

  // Moderation workflow via metadata flags
  async flagForModeration(id: string, reason: string): Promise<Song> {
    const song = await this.findOne(id);
    song.metadata = { ...(song.metadata || {}), moderation: { status: "flagged", reason } } as any;
    return this.songsRepo.save(song);
  }

  async approveModeration(id: string): Promise<Song> {
    const song = await this.findOne(id);
    song.metadata = { ...(song.metadata || {}), moderation: { status: "approved" } } as any;
    return this.songsRepo.save(song);
  }

  // Metadata enrichment: naive derivations
  private enrichMetadata(input: Partial<Song>): Record<string, any> {
    const existing = (input as any).metadata || {};
    const parsed = parseAndValidateLyrics(input.lyrics);
    const popularity = existing.popularity ?? Math.min(100, (parsed?.totalLines || 0) + (input.durationSeconds || 0) / 10);
    const explicit = existing.explicit ?? (parsed ? parsed.profanityScore > 0.2 : false);
    return {
      ...existing,
      popularity,
      explicit,
      lyricsStats: parsed || undefined,
      fingerprint: this.buildFingerprint(input.title || "", input.artist || ""),
      lyricsHash: computeLyricsHash(input.lyrics || undefined),
    };
  }
}


