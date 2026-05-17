import type { Song } from './api';

type EffectiveSongLike = Pick<Song, 'song_id' | 'title' | 'artist' | 'actual_id'> & {
  status?: Song['status'];
  timestamp?: number;
  created_at?: number;
};

const TITLE_SUFFIX_RE = /[\(\[]\s*(?:official\s+(?:(?:music|hd|4k|hq|8k|full)\s+)*(?:video|audio|lyric\s+video|visualizer)|music\s+video|lyric\s+video|visualizer|audio|video|mv|m\/v|4k|hd|hq|8k)\s*[\)\]]/gi;
const UNBRACKETED_SUFFIX_RE = /\s+(?:official\s+(?:(?:music|hd|4k|hq|8k|full)\s+)*(?:video|audio|lyric\s+video|visualizer)|music\s+video|lyric\s+video)\s*$/i;
const TRAILING_TOPIC_RE = /\s*-\s*Topic\s*$/i;
const TRAILING_DASH_RE = /\s*-\s*$/;
const MULTI_SPACE_RE = /\s{2,}/g;

const songTextCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
  ignorePunctuation: true,
});

/**
 * Extract artist and title parts from a song.
 * Uses song.artist if available; otherwise infers from the first " - " in the title.
 * Returns { artist, title } where artist may be empty.
 */
export function splitArtistTitle(song: Pick<Song, 'title' | 'artist'>): { artist: string; title: string } {
  const raw = song.title || '';
  const artist = song.artist || (() => {
    const idx = raw.indexOf(' - ');
    return idx > 0 ? raw.substring(0, idx) : '';
  })();
  if (!artist) return { artist: '', title: raw };
  const prefix = `${artist} - `;
  if (raw.toLowerCase().startsWith(prefix.toLowerCase())) {
    return { artist, title: raw.slice(prefix.length) };
  }
  return { artist, title: raw };
}

/**
 * Strip the "artist - " prefix from a song title when the artist is known.
 * Case-insensitive match. Returns the title as-is when no artist or no match.
 */
export function normalizeTitle(song: Pick<Song, 'title' | 'artist'>): string {
  return splitArtistTitle(song).title;
}

export function compareSongsByArtistThenTitle(
  a: Pick<Song, 'title' | 'artist'>,
  b: Pick<Song, 'title' | 'artist'>
): number {
  const aParts = splitArtistTitle(a);
  const bParts = splitArtistTitle(b);

  const artistCmp = songTextCollator.compare(aParts.artist, bParts.artist);
  if (artistCmp !== 0) return artistCmp;

  const titleCmp = songTextCollator.compare(aParts.title, bParts.title);
  if (titleCmp !== 0) return titleCmp;

  return songTextCollator.compare(a.title || '', b.title || '');
}

export function normalizeDisplayText(text: string): string {
  let normalized = decodeHtmlEntities(text || '');
  normalized = normalized.replace(TITLE_SUFFIX_RE, '');
  normalized = normalized.replace(UNBRACKETED_SUFFIX_RE, '');
  normalized = normalized.replace(TRAILING_TOPIC_RE, '');
  normalized = normalized.replace(TRAILING_DASH_RE, '');
  normalized = normalized.replace(MULTI_SPACE_RE, ' ');
  return normalized.trim().toLowerCase();
}

function getEffectiveSongKeys(song: EffectiveSongLike): string[] {
  const { artist, title } = splitArtistTitle(song);
  const normalizedArtist = normalizeDisplayText(artist || '');
  const normalizedTitle = normalizeDisplayText(title || song.title || song.song_id);
  const keys = [`meta:${normalizedArtist}::${normalizedTitle}`];

  if (song.actual_id) {
    keys.unshift(`actual:${song.actual_id}`);
  }

  return keys;
}

function pickPreferredSongVariant<T extends EffectiveSongLike>(a: T, b: T): T {
  const aComplete = a.status === 'COMPLETE' ? 1 : 0;
  const bComplete = b.status === 'COMPLETE' ? 1 : 0;
  if (aComplete !== bComplete) {
    return bComplete > aComplete ? b : a;
  }

  const aHasActual = a.actual_id ? 1 : 0;
  const bHasActual = b.actual_id ? 1 : 0;
  if (aHasActual !== bHasActual) {
    return bHasActual > aHasActual ? b : a;
  }

  const aRecency = a.timestamp ?? a.created_at ?? 0;
  const bRecency = b.timestamp ?? b.created_at ?? 0;
  if (aRecency !== bRecency) {
    return bRecency > aRecency ? b : a;
  }

  return a;
}

export function deduplicateSongsByEffectiveTrack<T extends EffectiveSongLike>(songs: T[]): T[] {
  const groups = new Map<string, T>();
  const aliases = new Map<string, string>();

  for (const song of songs) {
    const keys = getEffectiveSongKeys(song);
    const canonicalKey = keys
      .map((key) => aliases.get(key) || key)
      .find((key) => groups.has(key)) || keys[0];

    const existing = groups.get(canonicalKey);
    groups.set(canonicalKey, existing ? pickPreferredSongVariant(existing, song) : song);

    for (const key of keys) {
      aliases.set(key, canonicalKey);
    }
  }

  return Array.from(groups.values());
}

/**
 * Decode HTML entities in a string
 * Example: "Don&#x27;t" -> "Don't"
 */
/**
 * Fisher-Yates shuffle. Returns a new array; does not mutate the input.
 */
export function shuffleArray<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function decodeHtmlEntities(text: string): string {
  if (typeof document === 'undefined') {
    // Server-side: use a simple regex replacement for common entities
    return text
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, "/")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
      .replace(/&#x([0-9A-Fa-f]+);/g, (match, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  // Client-side: use browser's built-in HTML parser
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}
