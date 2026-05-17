import { NextRequest, NextResponse } from 'next/server';
const youtubeSearch = require('youtube-search-api');

interface VideoCandidate {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  views: number;
  durationSec: number;
}

interface YouTubeSearchResult {
  id: string;
  url: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
}

function decodeHtmlEntities(text: string): string {
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

function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function parseViews(viewStr: string | undefined): number {
  if (!viewStr) return 0;
  const match = viewStr.match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'K') return num * 1000;
  if (suffix === 'M') return num * 1000000;
  if (suffix === 'B') return num * 1000000000;
  return num;
}

// === Filters ===

function isBadResult(title: string): boolean {
  return /instrumental|karaoke|\binst\b|\binst\./i.test(title)
    || /\blive\b|\bconcert\b|\bperformance\b|\btour\b|dance practice/i.test(title)
    || /\bcover\b|\bremix\b|\bbootleg\b|\bmashup\b|\bflip\b/i.test(title);
}

function isOfficialAudio(title: string): boolean {
  return /official\s+audio/i.test(title);
}

function isLyricVideo(title: string): boolean {
  return /lyric|lyrics/i.test(title);
}

function isMusicVideo(title: string): boolean {
  return /official\s+(?:(?:music|hd|4k|hq|full)\s+)*video|\bm\/?v\b/i.test(title);
}

// === Relevance ===

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u0080-\uffff]+/g, ' ')
    .trim();
}

function queryRelevance(title: string, channel: string, query: string): number {
  const combined = normalizeText(title) + ' ' + normalizeText(channel);
  const words = normalizeText(query).split(/\s+/).filter(w => w.length > 0);
  if (words.length === 0) return 1;
  let matched = 0;
  for (const w of words) {
    if (combined.includes(w)) matched++;
  }
  return matched / words.length;
}

// === Search ===

async function fetchVideos(query: string, limit = 15): Promise<VideoCandidate[]> {
  try {
    const results = await youtubeSearch.GetListByKeyword(query, false, limit);
    if (!results?.items) return [];

    return results.items
      .filter((item: any) => item.type === 'video')
      .map((item: any) => {
        const duration = item.length?.simpleText || '';
        return {
          id: item.id,
          title: decodeHtmlEntities(item.title || ''),
          channel: decodeHtmlEntities(item.channelTitle || ''),
          duration,
          thumbnail: item.thumbnail?.thumbnails?.[0]?.url || '',
          views: parseViews(item.viewCount || item.views),
          durationSec: parseDuration(duration),
        };
      })
      .filter((v: VideoCandidate) => !isBadResult(v.title) && v.durationSec >= 30 && v.durationSec <= 600);
  } catch (error) {
    console.error('YouTube search error:', query, error);
    return [];
  }
}

function toResult(v: VideoCandidate): YouTubeSearchResult {
  return {
    id: v.id,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    title: v.title,
    channel: v.channel,
    duration: v.duration,
    thumbnail: v.thumbnail,
  };
}

/**
 * Pick the best video from search results.
 *
 * Strategy:
 * 1. Search for "[query] audio" to find official audio and lyric videos
 * 2. Score every result by relevance to the original query
 * 3. Only apply category priority (Official Audio > Lyric > MV) to results
 *    that closely match the query — prevents wrong-artist "Official Audio" wins
 * 4. Use lyric video duration as the "true song length" reference
 * 5. If an MV matches that duration (within 5s), it's clean — use it
 *    If the MV is longer, it has an intro — prefer audio/lyric version
 */
async function searchYouTube(query: string): Promise<YouTubeSearchResult | null> {
  const videos = await fetchVideos(query + ' audio', 15);
  if (videos.length === 0) return null;

  // Score relevance against the original query (without " audio" suffix)
  const scored = videos.map(v => ({
    ...v,
    relevance: queryRelevance(v.title, v.channel, query),
  }));

  // Only apply category-based priority to results that closely match the query.
  // This prevents a popular "Official Audio" by the wrong artist from winning.
  const RELEVANCE_THRESHOLD = 0.8;
  const relevant = scored.filter(v => v.relevance >= RELEVANCE_THRESHOLD);
  const pool = relevant.length > 0 ? relevant : scored;
  pool.sort((a, b) => b.relevance - a.relevance);

  // Categorize from the relevant pool
  const audios = pool.filter(v => isOfficialAudio(v.title));
  const lyrics = pool.filter(v => isLyricVideo(v.title) && !isOfficialAudio(v.title));
  const mvs = pool.filter(v => isMusicVideo(v.title));

  // Best official audio — wins if available in relevant pool
  if (audios.length > 0) {
    return toResult(audios[0]);
  }

  // Get reference duration from lyric video
  const referenceDur = lyrics.length > 0 ? lyrics[0].durationSec : 0;

  // Check if any MV is "clean" (matches lyric video duration within 5s)
  if (referenceDur > 0 && mvs.length > 0) {
    const cleanMv = mvs.find(v => Math.abs(v.durationSec - referenceDur) <= 5);
    if (cleanMv) {
      // MV matches lyric video length — no intro, safe to use
      return toResult(cleanMv);
    }
    // MV is longer — has intro, prefer lyric video
    return toResult(lyrics[0]);
  }

  // Have lyric video but no MV — use lyric video
  if (lyrics.length > 0) {
    return toResult(lyrics[0]);
  }

  // Have MV but no lyric reference — use MV (can't tell if it has intro)
  if (mvs.length > 0) {
    return toResult(mvs[0]);
  }

  // Fallback: most relevant result
  return toResult(pool[0]);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    let searchQuery: string;

    if (body.query) {
      searchQuery = body.query;
    } else if (body.artist && body.title) {
      searchQuery = `${body.artist} ${body.title}`;
    } else if (body.title) {
      searchQuery = body.title;
    } else {
      return NextResponse.json(
        { error: 'Query or title is required' },
        { status: 400 }
      );
    }

    const result = await searchYouTube(searchQuery);

    if (!result) {
      return NextResponse.json(
        { error: 'No YouTube video found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('YouTube search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
