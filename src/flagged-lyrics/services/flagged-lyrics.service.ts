import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlaggedLyrics, FlagStatus } from '../entities/flagged-lyrics.entity';
import { CreateFlagDto } from '../dto/create-flag.dto';
import { ResolveFlagDto } from '../dto/resolve-flag.dto';
import { FlaggedLyricsResponseDto } from '../dto/flagged-lyrics-response.dto';
import { plainToInstance } from 'class-transformer';

@Injectable()
export class FlaggedLyricsService {
  constructor(
    @InjectRepository(FlaggedLyrics)
    private flaggedLyricsRepository: Repository<FlaggedLyrics>,
  ) {}

  async createFlag(
    createFlagDto: CreateFlagDto,
    flaggedByUserId: string,
  ): Promise<FlaggedLyrics> {
    const flag = this.flaggedLyricsRepository.create({
      ...createFlagDto,
      flaggedByUserId,
      status: FlagStatus.PENDING,
    });

    return await this.flaggedLyricsRepository.save(flag);
  }

  async getAllFlags(): Promise<FlaggedLyricsResponseDto[]> {
    const flags = await this.flaggedLyricsRepository.find({
      relations: ['lyrics', 'flaggedBy', 'resolvedBy'],
      order: { createdAt: 'DESC' },
    });

    return flags.map((flag) => ({
      id: flag.id,
      reason: flag.reason,
      status: flag.status,
      resolutionNotes: flag.resolutionNotes,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
      lyrics: {
        id: flag.lyrics.id,
        snippet: flag.lyrics.snippet,
        correctCompletion: flag.lyrics.correctCompletion,
        artist: flag.lyrics.artist,
        songTitle: flag.lyrics.songTitle,
        category: flag.lyrics.category,
        difficulty: flag.lyrics.difficulty,
      },
      flaggedBy: {
        id: flag.flaggedBy.id,
        username: flag.flaggedBy.username,
        email: flag.flaggedBy.email,
      },
      resolvedBy: flag.resolvedBy
        ? {
            id: flag.resolvedBy.id,
            username: flag.resolvedBy.username,
            email: flag.resolvedBy.email,
          }
        : undefined,
    }));
  }

  async getPendingFlags(): Promise<FlaggedLyricsResponseDto[]> {
    const flags = await this.flaggedLyricsRepository.find({
      where: { status: FlagStatus.PENDING },
      relations: ['lyrics', 'flaggedBy', 'resolvedBy'],
      order: { createdAt: 'DESC' },
    });

    return flags.map((flag) => ({
      id: flag.id,
      reason: flag.reason,
      status: flag.status,
      resolutionNotes: flag.resolutionNotes,
      createdAt: flag.createdAt,
      updatedAt: flag.updatedAt,
      lyrics: {
        id: flag.lyrics.id,
        snippet: flag.lyrics.snippet,
        correctCompletion: flag.lyrics.correctCompletion,
        artist: flag.lyrics.artist,
        songTitle: flag.lyrics.songTitle,
        category: flag.lyrics.category,
        difficulty: flag.lyrics.difficulty,
      },
      flaggedBy: {
        id: flag.flaggedBy.id,
        username: flag.flaggedBy.username,
        email: flag.flaggedBy.email,
      },
      resolvedBy: undefined, // Pending flags don't have resolvers
    }));
  }

  async findById(id: number): Promise<FlaggedLyrics> {
    const flag = await this.flaggedLyricsRepository.findOne({
      where: { id },
      relations: ['lyrics', 'flaggedBy', 'resolvedBy'],
    });

    if (!flag) {
      throw new NotFoundException(`Flagged lyrics with ID ${id} not found`);
    }

    return flag;
  }

  async resolveFlag(
    id: number,
    resolveFlagDto: ResolveFlagDto,
    resolvedByUserId: string,
  ): Promise<FlaggedLyricsResponseDto> {
    const flag = await this.findById(id);

    if (flag.status !== FlagStatus.PENDING) {
      throw new Error(`Flag ${id} has already been resolved`);
    }

    flag.status = resolveFlagDto.status;
    flag.resolutionNotes = resolveFlagDto.resolutionNotes;
    flag.resolvedByUserId = resolvedByUserId;

    const savedFlag = await this.flaggedLyricsRepository.save(flag);

    // Fetch the updated flag with all relations
    const updatedFlag = await this.flaggedLyricsRepository.findOne({
      where: { id: savedFlag.id },
      relations: ['lyrics', 'flaggedBy', 'resolvedBy'],
    });

    return {
      id: updatedFlag.id,
      reason: updatedFlag.reason,
      status: updatedFlag.status,
      resolutionNotes: updatedFlag.resolutionNotes,
      createdAt: updatedFlag.createdAt,
      updatedAt: updatedFlag.updatedAt,
      lyrics: {
        id: updatedFlag.lyrics.id,
        snippet: updatedFlag.lyrics.snippet,
        correctCompletion: updatedFlag.lyrics.correctCompletion,
        artist: updatedFlag.lyrics.artist,
        songTitle: updatedFlag.lyrics.songTitle,
        category: updatedFlag.lyrics.category,
        difficulty: updatedFlag.lyrics.difficulty,
      },
      flaggedBy: {
        id: updatedFlag.flaggedBy.id,
        username: updatedFlag.flaggedBy.username,
        email: updatedFlag.flaggedBy.email,
      },
      resolvedBy: updatedFlag.resolvedBy
        ? {
            id: updatedFlag.resolvedBy.id,
            username: updatedFlag.resolvedBy.username,
            email: updatedFlag.resolvedBy.email,
          }
        : undefined,
    };
  }

  async getFlagsByLyricsId(lyricsId: number): Promise<FlaggedLyrics[]> {
    return await this.flaggedLyricsRepository.find({
      where: { lyricsId },
      relations: ['flaggedBy', 'resolvedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getFlagsByUserId(userId: string): Promise<FlaggedLyrics[]> {
    return await this.flaggedLyricsRepository.find({
      where: { flaggedByUserId: userId },
      relations: ['lyrics', 'resolvedBy'],
      order: { createdAt: 'DESC' },
    });
  }
}
