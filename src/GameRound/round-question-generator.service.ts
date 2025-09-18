import { Injectable } from '@nestjs/common';
import { Song } from './entities/song.entity';
import { QuestionType } from './entities/game-round.entity';

export interface QuestionGenerationOptions {
  difficulty?: 'easy' | 'medium' | 'hard';
  includeHints?: boolean;
  customSettings?: Record<string, any>;
  playerHistory?: PlayerHistory;
  category?: string;
  avoidRecentSongs?: string[];
}

export interface PlayerHistory {
  correctAnswers: number;
  totalAnswers: number;
  averageResponseTime: number;
  preferredQuestionTypes: QuestionType[];
  weakAreas: string[];
}

export interface GeneratedQuestion {
  question: string;
  options?: string[];
  correctAnswer: string | number;
  hints?: string[];
  audioClipStart?: number;
  audioClipDuration?: number;
  lyricsSnippet?: string;
  metadata?: {
    difficulty: string;
    category: string;
    estimatedTime: number;
    cognitiveLoad: 'low' | 'medium' | 'high';
  };
}

@Injectable()
export class RoundQuestionGeneratorService {
  private readonly questionTemplates = {
    multipleChoice: {
      artist: [
        'Who performed "{title}"?',
        'Which artist released "{title}"?',
        'Who is the singer of "{title}"?',
        'Which musician recorded "{title}"?'
      ],
      year: [
        'What year was "{title}" released?',
        'When was "{title}" first published?',
        'In which year did "{title}" come out?',
        'What year did "{title}" debut?'
      ],
      genre: [
        'What genre is "{title}"?',
        'Which musical style is "{title}"?',
        'How would you classify "{title}"?',
        'What type of music is "{title}"?'
      ],
      album: [
        'Which album contains "{title}"?',
        'What album is "{title}" from?',
        'On which album was "{title}" released?'
      ]
    },
    trueFalse: [
      '"{title}" was performed by {artist}',
      '"{title}" was released in {year}',
      '"{title}" belongs to the {genre} genre',
      '"{title}" is from the album "{album}"'
    ],
    fillInBlank: {
      title: [
        'Complete the song title: "{partial}"',
        'Fill in the missing word: "{partial}"',
        'What completes this title: "{partial}"?'
      ],
      artist: [
        'Who sang "{title}"?',
        'Complete: "{title}" by ___',
        'Fill in the artist: "{title}" by ___'
      ]
    }
  };

  generateQuestion(
    song: Song, 
    questionType: QuestionType,
    options: QuestionGenerationOptions = {}
  ): GeneratedQuestion {
    const baseQuestion = this.generateBaseQuestion(song, questionType, options);
    
    // Add metadata
    baseQuestion.metadata = {
      difficulty: options.difficulty || 'medium',
      category: options.category || 'general',
      estimatedTime: this.estimateQuestionTime(questionType, options.difficulty),
      cognitiveLoad: this.calculateCognitiveLoad(questionType, options.difficulty),
    };

    return baseQuestion;
  }

  private generateBaseQuestion(
    song: Song, 
    questionType: QuestionType,
    options: QuestionGenerationOptions
  ): GeneratedQuestion {
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

  private generateMultipleChoice(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    const categories = this.selectQuestionCategory(song, options);
    const category = this.weightedRandomSelect(categories);
    
    switch (category) {
      case 'artist':
        return this.generateArtistQuestion(song, options);
      case 'year':
        return this.generateYearQuestion(song, options);
      case 'genre':
        return this.generateGenreQuestion(song, options);
      case 'album':
        return this.generateAlbumQuestion(song, options);
      default:
        return this.generateArtistQuestion(song, options);
    }
  }

  private generateArtistQuestion(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    const templates = this.questionTemplates.multipleChoice.artist;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const question = template.replace('{title}', song.title);
    
    const correctAnswer = song.artist;
    const answerOptions = this.generateArtistOptions(song.artist, options.difficulty);
    
    return {
      question,
      correctAnswer,
      options: this.shuffleArray(answerOptions),
      hints: options.includeHints ? this.generateArtistHints(song) : undefined,
    };
  }

  private generateYearQuestion(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    if (!song.releaseYear) {
      return this.generateArtistQuestion(song, options); // Fallback
    }

    const templates = this.questionTemplates.multipleChoice.year;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const question = template.replace('{title}', song.title);
    
    const correctAnswer = song.releaseYear.toString();
    const answerOptions = this.generateYearOptions(song.releaseYear, options.difficulty);
    
    return {
      question,
      correctAnswer,
      options: this.shuffleArray(answerOptions),
      hints: options.includeHints ? this.generateYearHints(song) : undefined,
    };
  }

  private generateGenreQuestion(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    if (!song.genre) {
      return this.generateArtistQuestion(song, options); // Fallback
    }

    const templates = this.questionTemplates.multipleChoice.genre;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const question = template.replace('{title}', song.title);
    
    const correctAnswer = song.genre;
    const answerOptions = this.generateGenreOptions(song.genre, options.difficulty);
    
    return {
      question,
      correctAnswer,
      options: this.shuffleArray(answerOptions),
      hints: options.includeHints ? this.generateGenreHints(song) : undefined,
    };
  }

  private generateAlbumQuestion(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    if (!song.album) {
      return this.generateArtistQuestion(song, options); // Fallback
    }

    const templates = this.questionTemplates.multipleChoice.album;
    const template = templates[Math.floor(Math.random() * templates.length)];
    const question = template.replace('{title}', song.title);
    
    const correctAnswer = song.album;
    const answerOptions = this.generateAlbumOptions(song.album, options.difficulty);
    
    return {
      question,
      correctAnswer,
      options: this.shuffleArray(answerOptions),
      hints: options.includeHints ? this.generateAlbumHints(song) : undefined,
    };
  }

  private generateTrueFalse(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    const templates = this.questionTemplates.trueFalse;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Randomly decide if statement should be true or false
    const shouldBeTrue = Math.random() < 0.6; // 60% true statements
    
    let question: string;
    let correctAnswer: boolean;
    
    if (template.includes('{artist}')) {
      if (shouldBeTrue) {
        question = template.replace('{artist}', song.artist);
        correctAnswer = true;
      } else {
        question = template.replace('{artist}', this.getRandomArtist());
        correctAnswer = false;
      }
    } else if (template.includes('{year}')) {
      if (shouldBeTrue) {
        question = template.replace('{year}', song.releaseYear?.toString() || 'unknown');
        correctAnswer = true;
      } else {
        const wrongYear = song.releaseYear ? song.releaseYear + this.getRandomYearOffset() : 2020;
        question = template.replace('{year}', wrongYear.toString());
        correctAnswer = false;
      }
    } else if (template.includes('{genre}')) {
      if (shouldBeTrue) {
        question = template.replace('{genre}', song.genre || 'unknown');
        correctAnswer = true;
      } else {
        question = template.replace('{genre}', this.getRandomGenre());
        correctAnswer = false;
      }
    } else if (template.includes('{album}')) {
      if (shouldBeTrue) {
        question = template.replace('{album}', song.album || 'unknown');
        correctAnswer = true;
      } else {
        question = template.replace('{album}', this.getRandomAlbum());
        correctAnswer = false;
      }
    } else {
      // Fallback
      question = `"${song.title}" was performed by ${song.artist}`;
      correctAnswer = true;
    }

    return {
      question,
      correctAnswer: correctAnswer.toString(),
      hints: options.includeHints ? this.generateTrueFalseHints(song, correctAnswer) : undefined,
    };
  }

  private generateFillInBlank(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    const fillInTypes = this.selectFillInType(song, options);
    const fillInType = this.weightedRandomSelect(fillInTypes);
    
    switch (fillInType) {
      case 'title':
        return this.generateTitleFillIn(song, options);
      case 'artist':
        return this.generateArtistFillIn(song, options);
      case 'lyrics':
        return this.generateLyricsFillIn(song, options);
      default:
        return this.generateTitleFillIn(song, options);
    }
  }

  private generateTitleFillIn(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    const templates = this.questionTemplates.fillInBlank.title;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    // Split title into words and remove one or more words
    const words = song.title.split(' ');
    const wordsToRemove = this.getWordsToRemove(words.length, options.difficulty);
    
    const partialTitle = words
      .map((word, index) => wordsToRemove.includes(index) ? '____' : word)
      .join(' ');
    
    const question = template.replace('{partial}', partialTitle);
    const correctAnswer = wordsToRemove.map(index => words[index]).join(' ');
    
    return {
      question,
      correctAnswer,
      hints: options.includeHints ? this.generateTitleFillInHints(song) : undefined,
    };
  }

  private generateArtistFillIn(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    const templates = this.questionTemplates.fillInBlank.artist;
    const template = templates[Math.floor(Math.random() * templates.length)];
    
    const question = template.replace('{title}', song.title);
    const correctAnswer = song.artist;
    
    return {
      question,
      correctAnswer,
      hints: options.includeHints ? this.generateArtistFillInHints(song) : undefined,
    };
  }

  private generateLyricsFillIn(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    if (!song.lyrics) {
      return this.generateTitleFillIn(song, options); // Fallback
    }

    // Extract a line from lyrics and remove a word
    const lines = song.lyrics.split('\n').filter(line => line.trim().length > 10);
    if (lines.length === 0) {
      return this.generateTitleFillIn(song, options); // Fallback
    }

    const selectedLine = lines[Math.floor(Math.random() * lines.length)];
    const words = selectedLine.trim().split(' ');
    const wordToRemove = Math.floor(Math.random() * words.length);
    
    const partialLyrics = words
      .map((word, index) => index === wordToRemove ? '____' : word)
      .join(' ');
    
    return {
      question: `Complete the lyrics: "${partialLyrics}"`,
      correctAnswer: words[wordToRemove],
      hints: options.includeHints ? [`This song is by ${song.artist}`] : undefined,
    };
  }

  private generateAudioClip(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    const clipDuration = this.getClipDuration(options.difficulty);
    const clipStart = this.selectOptimalClipStart(song, clipDuration, options.difficulty);
    
    const question = this.getAudioClipQuestion(options.difficulty);
    const correctAnswer = song.title;
    const answerOptions = this.generateAudioClipOptions(song.title, options.difficulty);
    
    return {
      question,
      correctAnswer,
      audioClipStart: clipStart,
      audioClipDuration: clipDuration,
      options: this.shuffleArray(answerOptions),
      hints: options.includeHints ? this.generateAudioClipHints(song, options.difficulty) : undefined,
    };
  }

  private generateLyricsGuess(song: Song, options: QuestionGenerationOptions): GeneratedQuestion {
    if (!song.lyrics) {
      return this.generateAudioClip(song, options); // Fallback
    }

    const lyricsSnippet = this.extractLyricsSnippet(song.lyrics, options.difficulty);
    const question = this.getLyricsQuestion(options.difficulty);
    const correctAnswer = song.title;
    const answerOptions = this.generateLyricsOptions(song.title, options.difficulty);
    
    return {
      question,
      lyricsSnippet,
      correctAnswer,
      options: this.shuffleArray(answerOptions),
      hints: options.includeHints ? this.generateLyricsHints(song, options.difficulty) : undefined,
    };
  }

  // Helper methods for question generation

  private selectQuestionCategory(song: Song, options: QuestionGenerationOptions): Record<string, number> {
    const categories = {
      artist: 0.4, // Most reliable
      year: song.releaseYear ? 0.25 : 0,
      genre: song.genre ? 0.2 : 0,
      album: song.album ? 0.15 : 0,
    };

    // Adjust weights based on difficulty
    if (options.difficulty === 'hard') {
      categories.artist = 0.2;
      categories.year = song.releaseYear ? 0.3 : 0;
      categories.genre = song.genre ? 0.3 : 0;
      categories.album = song.album ? 0.2 : 0;
    }

    return categories;
  }

  private selectFillInType(song: Song, options: QuestionGenerationOptions): Record<string, number> {
    const types = {
      title: 0.4,
      artist: 0.3,
      lyrics: song.lyrics ? 0.3 : 0,
    };

    if (options.difficulty === 'hard' && song.lyrics) {
      types.lyrics = 0.5;
      types.title = 0.3;
      types.artist = 0.2;
    }

    return types;
  }

  private weightedRandomSelect(weights: Record<string, number>): string {
    const total = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * total;
    
    for (const [key, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return key;
      }
    }
    
    return Object.keys(weights)[0]; // Fallback
  }

  private getWordsToRemove(wordCount: number, difficulty?: string): number[] {
    const maxWords = difficulty === 'easy' ? 1 : difficulty === 'hard' ? Math.min(3, wordCount - 1) : 2;
    const wordsToRemove = Math.min(maxWords, Math.max(1, Math.floor(wordCount * 0.3)));
    
    const indices = Array.from({ length: wordCount }, (_, i) => i);
    return this.shuffleArray(indices).slice(0, wordsToRemove);
  }

  private getClipDuration(difficulty?: string): number {
    const durations = {
      easy: 15,
      medium: 10,
      hard: 5,
    };
    return durations[difficulty || 'medium'];
  }

  private selectOptimalClipStart(song: Song, duration: number, difficulty?: string): number {
    const totalDuration = song.durationSeconds || 180; // Default 3 minutes
    const maxStart = Math.max(0, totalDuration - duration - 10); // Leave some buffer
    
    if (difficulty === 'easy') {
      // Start from beginning for easier recognition
      return Math.min(30, maxStart);
    } else if (difficulty === 'hard') {
      // Start from middle or end for harder recognition
      return Math.max(60, maxStart * 0.5);
    } else {
      // Medium difficulty - random start
      return Math.floor(Math.random() * maxStart);
    }
  }

  private getAudioClipQuestion(difficulty?: string): string {
    const questions = {
      easy: ["What song is this?", "Which song is playing?"],
      medium: ["Identify this song:", "What is the name of this track?"],
      hard: ["Name this song:", "Which track is this clip from?"],
    };
    
    const questionSet = questions[difficulty || 'medium'];
    return questionSet[Math.floor(Math.random() * questionSet.length)];
  }

  private getLyricsQuestion(difficulty?: string): string {
    const questions = {
      easy: ["Which song contains these lyrics?", "What song has these words?"],
      medium: ["Identify the song from these lyrics:", "Which track contains this verse?"],
      hard: ["Name the song with these lyrics:", "What song is this verse from?"],
    };
    
    const questionSet = questions[difficulty || 'medium'];
    return questionSet[Math.floor(Math.random() * questionSet.length)];
  }

  private extractLyricsSnippet(lyrics: string, difficulty?: string): string {
    const lines = lyrics.split('\n').filter(line => line.trim().length > 10);
    if (lines.length === 0) return "Sample lyrics...";

    const snippetLength = difficulty === 'easy' ? 3 : difficulty === 'hard' ? 1 : 2;
    const startLine = Math.floor(Math.random() * Math.max(1, lines.length - snippetLength));
    
    return lines.slice(startLine, startLine + snippetLength).join('\n');
  }

  // Option generation methods

  private generateArtistOptions(correctArtist: string, difficulty?: string): string[] {
    const options = [correctArtist];
    const wrongArtists = this.getRandomArtists(3);
    options.push(...wrongArtists);
    return options;
  }

  private generateYearOptions(correctYear: number, difficulty?: string): string[] {
    const options = [correctYear.toString()];
    const yearOffsets = difficulty === 'easy' ? [-2, -1, 1] : 
                       difficulty === 'hard' ? [-5, -3, 3, 5] : 
                       [-3, -1, 1, 3];
    
    yearOffsets.forEach(offset => {
      options.push((correctYear + offset).toString());
    });
    
    return options.slice(0, 4); // Limit to 4 options
  }

  private generateGenreOptions(correctGenre: string, difficulty?: string): string[] {
    const options = [correctGenre];
    const wrongGenres = this.getRandomGenres(3);
    options.push(...wrongGenres);
    return options;
  }

  private generateAlbumOptions(correctAlbum: string, difficulty?: string): string[] {
    const options = [correctAlbum];
    const wrongAlbums = this.getRandomAlbums(3);
    options.push(...wrongAlbums);
    return options;
  }

  private generateAudioClipOptions(correctTitle: string, difficulty?: string): string[] {
    const options = [correctTitle];
    const wrongTitles = this.getRandomSongTitles(3);
    options.push(...wrongTitles);
    return options;
  }

  private generateLyricsOptions(correctTitle: string, difficulty?: string): string[] {
    const options = [correctTitle];
    const wrongTitles = this.getRandomSongTitles(3);
    options.push(...wrongTitles);
    return options;
  }

  // Hint generation methods

  private generateArtistHints(song: Song): string[] {
    const hints = [];
    if (song.releaseYear) hints.push(`Released in ${song.releaseYear}`);
    if (song.genre) hints.push(`Genre: ${song.genre}`);
    return hints;
  }

  private generateYearHints(song: Song): string[] {
    const hints = [];
    hints.push(`Artist: ${song.artist}`);
    if (song.genre) hints.push(`Genre: ${song.genre}`);
    return hints;
  }

  private generateGenreHints(song: Song): string[] {
    const hints = [];
    hints.push(`Artist: ${song.artist}`);
    if (song.releaseYear) hints.push(`Released in ${song.releaseYear}`);
    return hints;
  }

  private generateAlbumHints(song: Song): string[] {
    const hints = [];
    hints.push(`Artist: ${song.artist}`);
    if (song.releaseYear) hints.push(`Released in ${song.releaseYear}`);
    return hints;
  }

  private generateTrueFalseHints(song: Song, isTrue: boolean): string[] {
    const hints = [];
    if (isTrue) {
      hints.push('This statement is correct');
    } else {
      hints.push('This statement is incorrect');
    }
    return hints;
  }

  private generateTitleFillInHints(song: Song): string[] {
    return [`Artist: ${song.artist}`, `Released in ${song.releaseYear || 'unknown year'}`];
  }

  private generateArtistFillInHints(song: Song): string[] {
    const hints = [];
    if (song.releaseYear) hints.push(`Released in ${song.releaseYear}`);
    if (song.genre) hints.push(`Genre: ${song.genre}`);
    return hints;
  }

  private generateAudioClipHints(song: Song, difficulty?: string): string[] {
    const hints = [];
    hints.push(`Artist: ${song.artist}`);
    if (difficulty === 'easy') {
      hints.push(`Released in ${song.releaseYear || 'unknown year'}`);
    }
    return hints;
  }

  private generateLyricsHints(song: Song, difficulty?: string): string[] {
    const hints = [];
    if (difficulty !== 'hard') {
      hints.push(`Artist: ${song.artist}`);
    }
    return hints;
  }

  // Utility methods

  private getRandomArtist(): string {
    const artists = [
      'The Beatles', 'Queen', 'Michael Jackson', 'Elvis Presley', 'Madonna',
      'Prince', 'David Bowie', 'Bob Dylan', 'John Lennon', 'Paul McCartney'
    ];
    return artists[Math.floor(Math.random() * artists.length)];
  }

  private getRandomGenre(): string {
    const genres = [
      'Rock', 'Pop', 'Jazz', 'Hip-Hop', 'Country', 'Electronic',
      'Classical', 'Blues', 'R&B', 'Reggae', 'Folk', 'Metal'
    ];
    return genres[Math.floor(Math.random() * genres.length)];
  }

  private getRandomAlbum(): string {
    const albums = [
      'Greatest Hits', 'The Album', 'Classic Collection', 'Best Of',
      'Greatest Songs', 'The Collection', 'Essential', 'Anthology'
    ];
    return albums[Math.floor(Math.random() * albums.length)];
  }

  private getRandomYearOffset(): number {
    return Math.floor(Math.random() * 10) + 1; // 1-10 years
  }

  private getRandomArtists(count: number): string[] {
    const artists = [
      'The Beatles', 'Queen', 'Michael Jackson', 'Elvis Presley', 'Madonna',
      'Prince', 'David Bowie', 'Bob Dylan', 'John Lennon', 'Paul McCartney',
      'Led Zeppelin', 'Pink Floyd', 'The Rolling Stones', 'AC/DC', 'U2',
      'Bruce Springsteen', 'Bob Marley', 'Stevie Wonder', 'Aretha Franklin', 'Whitney Houston'
    ];
    return this.shuffleArray(artists).slice(0, count);
  }

  private getRandomGenres(count: number): string[] {
    const genres = [
      'Rock', 'Pop', 'Jazz', 'Hip-Hop', 'Country', 'Electronic',
      'Classical', 'Blues', 'R&B', 'Reggae', 'Folk', 'Metal',
      'Alternative', 'Indie', 'Punk', 'Soul', 'Funk', 'Disco'
    ];
    return this.shuffleArray(genres).slice(0, count);
  }

  private getRandomAlbums(count: number): string[] {
    const albums = [
      'Greatest Hits', 'The Album', 'Classic Collection', 'Best Of',
      'Greatest Songs', 'The Collection', 'Essential', 'Anthology',
      'Live', 'Unplugged', 'Remastered', 'Deluxe Edition'
    ];
    return this.shuffleArray(albums).slice(0, count);
  }

  private getRandomSongTitles(count: number): string[] {
    const titles = [
      'Love Song', 'Dance Floor', 'Summer Nights', 'City Lights',
      'Wild Dreams', 'Electric Storm', 'Midnight Train', 'Golden Age',
      'Fire and Ice', 'Ocean Waves', 'Mountain High', 'River Deep'
    ];
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

  private estimateQuestionTime(questionType: QuestionType, difficulty?: string): number {
    const baseTimes = {
      [QuestionType.MULTIPLE_CHOICE]: 15,
      [QuestionType.TRUE_FALSE]: 10,
      [QuestionType.FILL_IN_BLANK]: 20,
      [QuestionType.AUDIO_CLIP]: 25,
      [QuestionType.LYRICS_GUESS]: 30,
    };

    const difficultyMultipliers = {
      easy: 0.8,
      medium: 1.0,
      hard: 1.3,
    };

    const baseTime = baseTimes[questionType] || 20;
    const multiplier = difficultyMultipliers[difficulty || 'medium'];
    
    return Math.round(baseTime * multiplier);
  }

  private calculateCognitiveLoad(questionType: QuestionType, difficulty?: string): 'low' | 'medium' | 'high' {
    const loadMap = {
      [QuestionType.TRUE_FALSE]: 'low',
      [QuestionType.MULTIPLE_CHOICE]: 'medium',
      [QuestionType.FILL_IN_BLANK]: 'medium',
      [QuestionType.AUDIO_CLIP]: 'high',
      [QuestionType.LYRICS_GUESS]: 'high',
    };

    const baseLoad = loadMap[questionType] || 'medium';
    
    if (difficulty === 'hard' && baseLoad !== 'high') {
      return baseLoad === 'low' ? 'medium' : 'high';
    }
    
    if (difficulty === 'easy' && baseLoad !== 'low') {
      return baseLoad === 'high' ? 'medium' : 'low';
    }
    
    return baseLoad as 'low' | 'medium' | 'high';
  }
}
