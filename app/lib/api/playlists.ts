import { API_BASE, createHeaders, getAuthToken, getCurrentUserId, requireCurrentUserId } from './client';
import type {
  PlaylistMutationResponse,
  PlaylistShareResponse,
  PlaylistWithSongs,
  ShortCodePlaylistResponse,
  UserPlaylistsResponse,
} from './types';

const getPlaylistsPromises = new Map<string, Promise<UserPlaylistsResponse>>();

export async function getUserPlaylists(forceRefresh = false): Promise<UserPlaylistsResponse> {
  const userId = getCurrentUserId();
  if (!userId) {
    return { playlists: [] };
  }

  if (forceRefresh) {
    return _getUserPlaylists(true);
  }

  const existingPromise = getPlaylistsPromises.get(userId);
  if (existingPromise) return existingPromise;

  const promise = (async () => {
    try {
      return await _getUserPlaylists(false);
    } finally {
      getPlaylistsPromises.delete(userId);
    }
  })();

  getPlaylistsPromises.set(userId, promise);
  return promise;
}

async function _getUserPlaylists(forceRefresh = false): Promise<UserPlaylistsResponse> {
  const userId = getCurrentUserId();
  if (!userId) {
    return { playlists: [] };
  }
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const cacheBust = forceRefresh ? `?ts=${Date.now()}` : '';
  const response = await fetch(`${API_BASE}/users/${userId}/playlists${cacheBust}`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    return { playlists: [] };
  }

  return response.json();
}

export async function getPlaylist(playlistId: string, nocache = false): Promise<PlaylistWithSongs> {
  const headers = await createHeaders();

  const url = nocache ? `${API_BASE}/playlists/${playlistId}?nocache=1` : `${API_BASE}/playlists/${playlistId}`;
  const response = await fetch(url, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch playlist');
  }

  return response.json();
}

export async function getOwnedPlaylist(userId: string, playlistId: string): Promise<PlaylistWithSongs> {
  const headers = await createHeaders();
  const response = await fetch(`${API_BASE}/users/${userId}/playlists/${playlistId}`, {
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Failed to fetch playlist');
  }

  return response.json();
}

export async function createPlaylist(name: string, songIds: string[]): Promise<PlaylistMutationResponse> {
  const userId = requireCurrentUserId('User ID required for playlist creation');
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/users/${userId}/playlists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      playlist_name: name,
      song_ids: songIds,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to create playlist');
  }

  return response.json();
}

export async function addSongsToPlaylist(playlistId: string, songIds: string[]): Promise<{ song_count: number }> {
  const userId = getCurrentUserId();
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const params = userId ? `?user_id=${userId}` : '';
  const response = await fetch(`${API_BASE}/playlists/${playlistId}/songs${params}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ song_ids: songIds }),
  });

  if (!response.ok) {
    throw new Error('Failed to add songs to playlist');
  }

  return response.json();
}

export async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
  const userId = getCurrentUserId();
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const params = userId ? `?user_id=${userId}` : '';
  const response = await fetch(`${API_BASE}/playlists/${playlistId}/songs/${songId}${params}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to remove song from playlist');
  }
}

export async function deletePlaylist(playlistId: string): Promise<void> {
  const userId = requireCurrentUserId('User ID required for playlist deletion');
  const token = await getAuthToken();

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/users/${userId}/playlists/${playlistId}`, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to delete playlist');
  }
}

export async function renamePlaylist(playlistId: string, newName: string, songIds: string[]): Promise<PlaylistMutationResponse> {
  const userId = requireCurrentUserId('User ID required for playlist updates');
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/users/${userId}/playlists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      playlist_id: playlistId,
      playlist_name: newName,
      song_ids: songIds,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to rename playlist');
  }

  return response.json();
}

export async function updatePlaylist(playlistId: string, songIds: string[]): Promise<PlaylistMutationResponse> {
  const userId = requireCurrentUserId('User ID required for playlist updates');
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/users/${userId}/playlists/${playlistId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      song_ids: songIds,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to update playlist');
  }

  return response.json();
}

export async function sharePlaylist(playlistId: string): Promise<PlaylistShareResponse> {
  const userId = requireCurrentUserId('Must be signed in to share playlists');

  const headers = await createHeaders();
  const response = await fetch(`${API_BASE}/users/${userId}/playlists/${playlistId}/share`, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to share playlist');
  }

  return response.json();
}

export async function getPublicPlaylist(userId: string, playlistId: string): Promise<PlaylistWithSongs> {
  const response = await fetch(`${API_BASE}/playlist/${userId}/${playlistId}`);

  if (!response.ok) {
    throw new Error('Failed to fetch public playlist');
  }

  return response.json();
}

export async function saveSharedPlaylist(originalUserId: string, playlistId: string): Promise<void> {
  const userId = requireCurrentUserId('Must be signed in to save playlists');

  const headers = await createHeaders();
  const response = await fetch(`${API_BASE}/users/${userId}/playlists/save`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      original_user_id: originalUserId,
      playlist_id: playlistId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to save playlist');
  }

  await response.json().catch(() => null);
}

export async function getPlaylistByShortCode(shortCode: string): Promise<ShortCodePlaylistResponse> {
  const response = await fetch(`${API_BASE}/p/${shortCode}`);

  if (!response.ok) {
    throw new Error('Failed to fetch playlist');
  }

  return response.json();
}
