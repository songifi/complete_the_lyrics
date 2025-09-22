import crypto from "crypto";

export type ParsedLyrics = {
  lines: string[];
  totalLines: number;
  avgLineLength: number;
  profanityScore: number; // 0..1
  containsNonAscii: boolean;
};

const PROFANITY_LIST = [
  "badword1",
  "badword2",
  "badword3",
];

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeLyricsHash(lyrics?: string): string | null {
  if (!lyrics) return null;
  const normalized = normalizeText(lyrics);
  return crypto.createHash("sha256").update(normalized).digest("hex");
}

export function parseAndValidateLyrics(lyrics?: string): ParsedLyrics | null {
  if (!lyrics) return null;
  const raw = lyrics.replace(/\r\n?/g, "\n");
  const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
  const totalLines = lines.length;
  const lengths = lines.map(l => l.length);
  const avgLineLength = lengths.length
    ? lengths.reduce((a, b) => a + b, 0) / lengths.length
    : 0;
  const normalized = normalizeText(lyrics);
  const profanityHits = PROFANITY_LIST.reduce((acc, word) => acc + (normalized.includes(word) ? 1 : 0), 0);
  const profanityScore = Math.min(1, profanityHits / Math.max(1, totalLines / 4));
  const containsNonAscii = /[^\x00-\x7F]/.test(lyrics);

  return {
    lines,
    totalLines,
    avgLineLength,
    profanityScore,
    containsNonAscii,
  };
}

export function isLyricsGameCompatible(parsed: ParsedLyrics | null): boolean {
  if (!parsed) return true;
  if (parsed.totalLines < 2) return false;
  if (parsed.avgLineLength < 3) return false;
  if (parsed.profanityScore > 0.5) return false;
  return true;
}


