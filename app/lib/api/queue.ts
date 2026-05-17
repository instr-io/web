import { API_BASE, getAuthToken, getCurrentUserId, requireCurrentUserId } from './client';
import type { QueueItem, Song } from './types';

export async function addToOfficialQueue(songIds: string[], addToFront: boolean = false): Promise<void> {
  const userId = requireCurrentUserId('User ID required for queue operations');
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/official`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: userId,
      song_ids: songIds,
      add_to_front: addToFront,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to add songs to official queue');
  }
}

export async function updateUnofficialQueue(): Promise<void> {
  const userId = requireCurrentUserId('User ID required for queue operations');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/unofficial/update?user_id=${userId}`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to update unofficial queue');
  }
}

export async function updateUnofficialQueueFromSongs(completedSongs: Song[], currentSongId: string, limit: number = 20): Promise<void> {
  const userId = requireCurrentUserId('User ID required for queue operations');

  const songIds = completedSongs.map(song => song.actual_id ?? song.song_id);
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/unofficial/direct`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: userId,
      song_ids: songIds,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to update unofficial queue from songs:', response.status, errorText);
    throw new Error(`Failed to update unofficial queue from songs: ${response.status}`);
  }
}

export async function getQueue(): Promise<QueueItem[]> {
  const userId = getCurrentUserId();
  if (!userId) {
    return [];
  }

  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue?user_id=${userId}`, {
    headers,
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  return data.items || [];
}

export async function popNextSong(previousSongId?: string, listenDurationSeconds?: number, previousArtist?: string): Promise<QueueItem | null> {
  const userId = getCurrentUserId();
  if (!userId) {
    return null;
  }
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const fetchOptions: RequestInit = {
    method: 'POST',
    headers,
  };

  if (previousSongId && listenDurationSeconds !== undefined && listenDurationSeconds > 0) {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify({
      previous_song_id: previousSongId,
      listen_duration_seconds: listenDurationSeconds,
      previous_artist: previousArtist || '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  fetchOptions.signal = controller.signal;

  const response = await fetch(`${API_BASE}/queue/pop?user_id=${userId}`, fetchOptions);
  clearTimeout(timeout);

  if (!response.ok) {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  const data = JSON.parse(text);
  return { song_id: data.song_id, index: data.index };
}

export async function toggleShuffle(): Promise<{ shuffle_enabled: boolean } | null> {
  const userId = requireCurrentUserId('User ID required for playback controls');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/shuffle?user_id=${userId}`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to toggle shuffle');
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    return { shuffle_enabled: data.shuffle_enabled };
  }

  return null;
}

export async function toggleRepeat(): Promise<{ repeat_all: boolean; repeat_one: boolean }> {
  const userId = requireCurrentUserId('User ID required for playback controls');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/repeat?user_id=${userId}`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to toggle repeat');
  }

  return response.json();
}

export async function getPlaybackState(): Promise<{
  repeat_all: boolean;
  repeat_one: boolean;
  shuffle_enabled: boolean;
  source: string;
}> {
  const userId = getCurrentUserId();
  if (!userId) {
    return {
      repeat_all: false,
      repeat_one: false,
      shuffle_enabled: false,
      source: 'user-songs',
    };
  }
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/state?user_id=${userId}`, {
    headers,
  });

  if (!response.ok) {
    return {
      repeat_all: false,
      repeat_one: false,
      shuffle_enabled: false,
      source: 'user-songs',
    };
  }

  return response.json();
}

export async function setPlaybackSource(source: string): Promise<void> {
  const userId = requireCurrentUserId('User ID required for playback operations');
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/source?user_id=${userId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ source }),
  });

  if (!response.ok) {
    throw new Error('Failed to set playback source');
  }
}

export async function setCurrentSong(songId: string): Promise<void> {
  const userId = requireCurrentUserId('User ID required for playback operations');
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/current-song`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ user_id: userId, song_id: songId }),
  });

  if (!response.ok) {
    throw new Error('Failed to set current song');
  }
}

export async function clearQueue(): Promise<void> {
  const userId = requireCurrentUserId('User ID required for queue operations');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue?user_id=${userId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to clear queue');
  }
}

export async function clearUnofficialQueue(): Promise<void> {
  const userId = requireCurrentUserId('User ID required for queue operations');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/unofficial?user_id=${userId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to clear unofficial queue');
  }
}

export async function removeFromQueue(index: number): Promise<void> {
  const userId = requireCurrentUserId('User ID required for queue operations');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/queue/${index}?user_id=${userId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to remove song from queue');
  }
}
