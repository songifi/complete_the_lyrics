import { FlagStatus } from '../entities/flagged-lyrics.entity';

export class FlaggedLyricsResponseDto {
  id: number;
  reason: string;
  status: FlagStatus;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;

  // Lyrics information
  lyrics: {
    id: number;
    snippet: string;
    correctCompletion: string;
    artist: string;
    songTitle: string;
    category: string;
    difficulty: string;
  };

  // Flagger information
  flaggedBy: {
    id: string;
    username: string;
    email: string;
  };

  // Resolver information (if resolved)
  resolvedBy?: {
    id: string;
    username: string;
    email: string;
  };
}
