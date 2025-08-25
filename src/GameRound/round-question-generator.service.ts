import { Injectable } from '@nestjs/common';
import { Song } from './entities/song.entity';
import { QuestionType } from './entities/game-round.entity';

export interface QuestionGenerationOptions {
  difficulty?: 'easy' | 'medium' | 'hard';
  includeHints?: boolean;
  customSettings?: Record<string, any>;
}

@Injectable()
export class RoundQuestionGeneratorService {
  generateQuestion(
    song: Song, 
    questionType: QuestionType,
    options: QuestionGenerationOptions = {}
  ) {
    switch (questionType) {
      case QuestionType.MULTIPLE_CHOICE:
        return this.generateMultipleChoice(song, options);
      case QuestionType.TRUE_FALSE:
        return this.generateTrueFalse(song, options);
      case QuestionType.FILL_IN_BLANK:
        return this.generateFillInBlank(song, options);
      case QuestionType.AUDIO_CLIP:
        return this.generateAudioClip(song, options);
      case QuestionType.LYRICS_GUESS:
        return this.generateLyricsGuess(song, options);
      default:
        throw new Error(`Unsupported question type: ${questionType}`);
    }
  }

  private generateMultipleChoice(song: Song, options: QuestionGenerationOptions) {
    const questions = [
      {
        question: `Who is the artist of "${song.title}"?`,
        correctAnswer: song.artist,
        options: [song.artist, ...this.getRandomArtists(3)],
      },
      {
        question: `What year was "${song.title}" released?`,
        correctAnswer: song.releaseYear?.toString(),
        options: [
          song.releaseYear?.toString(),
          (song.releaseYear - 1)?.toString(),
          (song.releaseYear + 1)?.toString(),
          (song.releaseYear - 2)?.toString(),
        ].filter(Boolean),
      },
      {
        question: `What genre is "${song.title}"?`,
        correctAnswer: song.genre,
        options: [song.genre, ...this.getRandomGenres(3)],
      },
    ];

    const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
    
    return {
      ...selectedQuestion,
      options: this.shuffleArray(selectedQuestion.options),
      hints: options.includeHints ? this.generateHints(song, selectedQuestion.question) : undefined,
    };
  }

  private generateTrueFalse(song: Song, options: QuestionGenerationOptions) {
    const statements = [
      {
        question: `"${song.title}" was performed by ${song.artist}`,
        correctAnswer: true,
      },
      {
        question: `"${song.title}" was released in ${song.releaseYear + 5}`,
        correctAnswer: false,
      },
      {
        question: `"${song.title}" belongs to the ${song.genre} genre`,
        correctAnswer: true,
      },
    ];

    return statements[Math.floor(Math.random() * statements.length)];
  }

  private generateFillInBlank(song: Song, options: QuestionGenerationOptions) {
    // This would integrate with lyrics data if available
    return {
      question: `Complete the song title: "${song.title.split(' ').slice(0, -1).join(' ')} ____"`,
      correctAnswer: song.title.split(' ').slice(-1)[0],
      hints: options.includeHints ? [`The song is by ${song.artist}`] : undefined,
    };
  }

  private generateAudioClip(song: Song, options: QuestionGenerationOptions) {
    const clipStart = Math.floor(Math.random() * 60); // Random start within first minute
    const clipDuration = options.difficulty === 'hard' ? 5 : options.difficulty === 'medium' ? 10 : 15;

    return {
      question: "What song is this?",
      correctAnswer: song.title,
      audioClipStart: clipStart,
      audioClipDuration: clipDuration,
      options: [song.title, ...this.getRandomSongTitles(3)],
      hints: options.includeHints ? [`The artist is ${song.artist}`] : undefined,
    };
  }

  private generateLyricsGuess(song: Song, options: QuestionGenerationOptions) {
    // This would use actual lyrics data
    return {
      question: "Which song contains these lyrics?",
      lyricsSnippet: "Sample lyrics snippet here...", // Would be actual lyrics
      correctAnswer: song.title,
      options: [song.title, ...this.getRandomSongTitles(3)],
      hints: options.includeHints ? [`Released in ${song.releaseYear}`] : undefined,
    };
  }

  private generateHints(song: Song, question: string): string[] {
    const hints = [];
    if (question.includes('artist')) {
      hints.push(`The song was released in ${song.releaseYear}`);
    }
    if (question.includes('year')) {
      hints.push(`The artist is ${song.artist}`);
    }
    if (question.includes('genre')) {
      hints.push(`The song was released in the ${Math.floor(song.releaseYear / 10) * 10}s`);
    }
    return hints;
  }

  private getRandomArtists(count: number): string[] {
    // This would pull from your actual artist database
    const artists = ['Artist 1', 'Artist 2', 'Artist 3', 'Artist 4', 'Artist 5'];
    return this.shuffleArray(artists).slice(0, count);
  }

  private getRandomGenres(count: number): string[] {
    const genres = ['Rock', 'Pop', 'Jazz', 'Hip-Hop', 'Country', 'Electronic'];
    return this.shuffleArray(genres).slice(0, count);
  }

  private getRandomSongTitles(count: number): string[] {
    const titles = ['Song A', 'Song B', 'Song C', 'Song D', 'Song E'];
    return this.shuffleArray(titles).slice(0, count);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
