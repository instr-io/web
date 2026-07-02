import { API_BASE, createHeaders, getAuthToken, getCurrentUserId, requireCurrentUserId } from './client';
import type { Song } from './types';

const getSongsPromises = new Map<string, Promise<Song[]>>();
const getSongPromises = new Map<string, Promise<Song>>();
const songCache = new Map<string, { song: Song; cachedAt: number }>();
const SONG_CACHE_TTL_MS = 10 * 60 * 1000;

function cacheSong(song: Song, ...keys: Array<string | undefined>) {
  const cachedAt = Date.now();
  const resolvedKeys = new Set<string>();

  for (const key of [song.song_id, song.actual_id, ...keys]) {
    if (key) {
      resolvedKeys.add(key);
    }
  }

  for (const key of resolvedKeys) {
    songCache.set(key, { song, cachedAt });
  }
}

function getFreshCachedSong(songId: string): Song | null {
  const cached = songCache.get(songId);
  if (!cached) {
    return null;
  }

  if (Date.now() - cached.cachedAt > SONG_CACHE_TTL_MS) {
    songCache.delete(songId);
    return null;
  }

  if (!cached.song.stream_url) {
    songCache.delete(songId);
    return null;
  }

  return cached.song;
}

export function primeSongCache(songs: Song[] | Song): void {
  const list = Array.isArray(songs) ? songs : [songs];
  for (const song of list) {
    if (!song.stream_url) {
      continue;
    }
    cacheSong(song);
  }
}

export async function getSongs(): Promise<Song[]> {
  const userId = requireCurrentUserId('User ID required to fetch songs');

  const existingPromise = getSongsPromises.get(userId);
  if (existingPromise) {
    return existingPromise;
  }

  const promise = (async () => {
    try {
      const headers = await createHeaders();
      const response = await fetch(`${API_BASE}/users/${userId}/songs`, { headers, cache: 'no-store' });

      if (!response.ok) {
        throw new Error('Failed to fetch songs');
      }

      const data = await response.json();
      const songs = data.songs || [];
      primeSongCache(songs);
      return songs;
    } finally {
      getSongsPromises.delete(userId);
    }
  })();

  getSongsPromises.set(userId, promise);
  return promise;
}

export async function getSong(songId: string): Promise<Song> {
  const cachedSong = getFreshCachedSong(songId);
  if (cachedSong) {
    return cachedSong;
  }

  const existingPromise = getSongPromises.get(songId);
  if (existingPromise) {
    return existingPromise;
  }

  const headers = await createHeaders();
  const promise = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${API_BASE}/song/${songId}`, { headers, cache: 'no-store', signal: controller.signal });

      if (!response.ok) {
        throw new Error('Failed to fetch song');
      }

      const song = await response.json();
      cacheSong(song, songId);
      return song;
    } finally {
      clearTimeout(timeout);
      getSongPromises.delete(songId);
    }
  })();

  getSongPromises.set(songId, promise);
  return promise;
}

export async function replaceSong(
  songId: string,
  youtubeUrl: string
): Promise<{ status: string; new_song_id?: string }> {
  const userId = getCurrentUserId();
  const headers = await createHeaders();

  const response = await fetch(`${API_BASE}/songs/${songId}/flag`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'replace', youtube_url: youtubeUrl, user_id: userId }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.new_title ? `"${body.new_title}"` : (body.error ?? 'request failed');
    throw new Error(`songs don't match: ${detail}`);
  }

  return response.json();
}

export async function addSong(url: string, title?: string, artist?: string, channel?: string): Promise<{song_id: string, user_id: string} | null> {
  const headers = await createHeaders();
  const body: Record<string, string> = { youtube_url: url };

  const normalizedTitle = title?.trim();
  const normalizedArtist = artist?.trim();

  if (normalizedTitle && normalizedArtist) {
    body.title = normalizedTitle;
    body.artist = normalizedArtist;
  }
  if (channel) body.channel = channel;

  const userId = requireCurrentUserId('User ID required to add songs');
  body.user_id = userId;

  const response = await fetch(`${API_BASE}/songs`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || 'Failed to add song';
    throw new Error(errorMessage);
  }

  return response.json();
}

export async function bulkDeleteSongs(songIds: string[]): Promise<void> {
  const userId = requireCurrentUserId('User ID required for song deletion');
  const headers = await createHeaders();

  const response = await fetch(`${API_BASE}/users/${userId}/songs/bulk-delete`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ song_ids: songIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to delete songs');
  }
}

export async function deleteSong(songId: string): Promise<void> {
  const userId = requireCurrentUserId('User ID required for song deletion');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/users/${userId}/songs/${songId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to delete song');
  }
}

export async function saveSongToLibrary(songId: string): Promise<void> {
  const userId = requireCurrentUserId('User ID required');
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/discover/save`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ song_id: songId }),
  });
  if (!response.ok) throw new Error('Failed to save song');
}

export async function bulkSaveSongs(songIds: string[]): Promise<{ saved: number }> {
  const userId = requireCurrentUserId('User ID required');
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}/songs/bulk-save`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ song_ids: songIds }),
  });
  if (!response.ok) throw new Error('Failed to save songs');
  return response.json();
}
