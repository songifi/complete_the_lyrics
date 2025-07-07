import { AppDataSource } from '../data-source';
import {
  Lyrics,
  LyricsCategory,
  LyricsDifficulty,
} from './entities/lyrics.entity';

const seedLyrics: Partial<Lyrics>[] = [
  // Pop
  {
    snippet: 'Just a small town girl, living in a...',
    correctCompletion: 'lonely world',
    artist: 'Journey',
    songTitle: "Don't Stop Believin'",
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: "Cause you know I'm all about that...",
    correctCompletion: 'bass',
    artist: 'Meghan Trainor',
    songTitle: 'All About That Bass',
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'Is it too late now to say...',
    correctCompletion: 'sorry',
    artist: 'Justin Bieber',
    songTitle: 'Sorry',
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: "I got a feeling that tonight's gonna be a...",
    correctCompletion: 'good night',
    artist: 'Black Eyed Peas',
    songTitle: 'I Gotta Feeling',
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'You are the dancing queen, young and...',
    correctCompletion: 'sweet, only seventeen',
    artist: 'ABBA',
    songTitle: 'Dancing Queen',
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  // Rock
  {
    snippet: 'We will, we will...',
    correctCompletion: 'rock you',
    artist: 'Queen',
    songTitle: 'We Will Rock You',
    category: LyricsCategory.ROCK,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'Hello darkness, my old...',
    correctCompletion: 'friend',
    artist: 'Simon & Garfunkel',
    songTitle: 'The Sound of Silence',
    category: LyricsCategory.ROCK,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  {
    snippet: "There's a lady who's sure all that glitters is...",
    correctCompletion: 'gold',
    artist: 'Led Zeppelin',
    songTitle: 'Stairway to Heaven',
    category: LyricsCategory.ROCK,
    difficulty: LyricsDifficulty.HARD,
  },
  {
    snippet: "It's been a long time since I...",
    correctCompletion: 'rock and rolled',
    artist: 'Led Zeppelin',
    songTitle: 'Rock and Roll',
    category: LyricsCategory.ROCK,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  {
    snippet: "I can't get no...",
    correctCompletion: 'satisfaction',
    artist: 'The Rolling Stones',
    songTitle: "(I Can't Get No) Satisfaction",
    category: LyricsCategory.ROCK,
    difficulty: LyricsDifficulty.EASY,
  },
  // Hip-Hop
  {
    snippet:
      'You better lose yourself in the music, the moment, you own it, you better never let it...',
    correctCompletion: 'go',
    artist: 'Eminem',
    songTitle: 'Lose Yourself',
    category: LyricsCategory.HIPHOP,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  {
    snippet: 'Now this is a story all about how my life got flipped-turned...',
    correctCompletion: 'upside down',
    artist: 'Will Smith',
    songTitle: 'The Fresh Prince of Bel-Air',
    category: LyricsCategory.HIPHOP,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'Cash rules everything around me, C.R.E.A.M. get the...',
    correctCompletion: 'money',
    artist: 'Wu-Tang Clan',
    songTitle: 'C.R.E.A.M.',
    category: LyricsCategory.HIPHOP,
    difficulty: LyricsDifficulty.HARD,
  },
  {
    snippet: 'Started from the bottom now we...',
    correctCompletion: 'here',
    artist: 'Drake',
    songTitle: 'Started From the Bottom',
    category: LyricsCategory.HIPHOP,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'I got 99 problems but a...',
    correctCompletion: "[explicit] ain't one",
    artist: 'Jay-Z',
    songTitle: '99 Problems',
    category: LyricsCategory.HIPHOP,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  // Country
  {
    snippet: 'Take me home, country...',
    correctCompletion: 'roads',
    artist: 'John Denver',
    songTitle: 'Take Me Home, Country Roads',
    category: LyricsCategory.COUNTRY,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'Blame it all on my roots, I showed up in...',
    correctCompletion: 'boots',
    artist: 'Garth Brooks',
    songTitle: 'Friends in Low Places',
    category: LyricsCategory.COUNTRY,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  {
    snippet: 'I will always love...',
    correctCompletion: 'you',
    artist: 'Dolly Parton',
    songTitle: 'I Will Always Love You',
    category: LyricsCategory.COUNTRY,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet:
      "Jolene, Jolene, Jolene, Jolene, I'm begging of you please don't take my...",
    correctCompletion: 'man',
    artist: 'Dolly Parton',
    songTitle: 'Jolene',
    category: LyricsCategory.COUNTRY,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  {
    snippet: 'Life is old there, older than the...',
    correctCompletion: 'trees',
    artist: 'John Denver',
    songTitle: 'Take Me Home, Country Roads',
    category: LyricsCategory.COUNTRY,
    difficulty: LyricsDifficulty.HARD,
  },
  // R&B
  {
    snippet: 'I believe I can...',
    correctCompletion: 'fly',
    artist: 'R. Kelly',
    songTitle: 'I Believe I Can Fly',
    category: LyricsCategory.RNB,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: "No, I don't want no...",
    correctCompletion: 'scrubs',
    artist: 'TLC',
    songTitle: 'No Scrubs',
    category: LyricsCategory.RNB,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'Say my name, say my name, if no one is...',
    correctCompletion: 'around you',
    artist: "Destiny's Child",
    songTitle: 'Say My Name',
    category: LyricsCategory.RNB,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  {
    snippet: 'If you wanna be my...',
    correctCompletion: 'lover',
    artist: 'Spice Girls',
    songTitle: 'Wannabe',
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'I want it that...',
    correctCompletion: 'way',
    artist: 'Backstreet Boys',
    songTitle: 'I Want It That Way',
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.EASY,
  },
  // Other/Decades
  {
    snippet: 'Imagine all the people living life in...',
    correctCompletion: 'peace',
    artist: 'John Lennon',
    songTitle: 'Imagine',
    category: LyricsCategory.OTHER,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  {
    snippet: 'Every breath you take, every move you...',
    correctCompletion: 'make',
    artist: 'The Police',
    songTitle: 'Every Breath You Take',
    category: LyricsCategory.ROCK,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'Hit me baby one more...',
    correctCompletion: 'time',
    artist: 'Britney Spears',
    songTitle: '...Baby One More Time',
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.EASY,
  },
  {
    snippet: 'Billie Jean is not my...',
    correctCompletion: 'lover',
    artist: 'Michael Jackson',
    songTitle: 'Billie Jean',
    category: LyricsCategory.POP,
    difficulty: LyricsDifficulty.MEDIUM,
  },
  {
    snippet: 'Sweet Caroline, good times never seemed so...',
    correctCompletion: 'good',
    artist: 'Neil Diamond',
    songTitle: 'Sweet Caroline',
    category: LyricsCategory.OTHER,
    difficulty: LyricsDifficulty.EASY,
  },
];

async function main() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(Lyrics);
  await repo.clear(); // Optional: clear existing data
  await repo.save(seedLyrics);
  console.log('Seeded lyrics table with', seedLyrics.length, 'entries.');
  await AppDataSource.destroy();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
