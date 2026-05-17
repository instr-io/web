import { API_BASE, getAuthToken, requireCurrentUserId } from './client';
import type { Artist, ArtistSong } from './types';

export async function saveArtist(artistName: string): Promise<{ playlist_id: string }> {
  const userId = requireCurrentUserId('User ID required');
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/discover/save-artist`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ artist_name: artistName }),
  });

  if (!response.ok) {
    throw new Error('Failed to save artist');
  }

  return response.json();
}

export async function getArtists(): Promise<Artist[]> {
  const response = await fetch(`${API_BASE}/discover/artists`);
  if (!response.ok) {
    throw new Error('Failed to fetch artists');
  }
  const data = await response.json();
  return data.artists || [];
}

export async function getArtistSongs(artist: string): Promise<ArtistSong[]> {
  const response = await fetch(`${API_BASE}/discover/songs?artist=${encodeURIComponent(artist)}`);
  if (!response.ok) {
    throw new Error('Failed to fetch artist songs');
  }
  const data = await response.json();
  return data.songs || [];
}
