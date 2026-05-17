'use client';

export type ImportSourceKind =
  | 'spotify-playlist'
  | 'spotify-album'
  | 'youtube'
  | 'search'
  | 'invalid';

export interface ImportSource {
  kind: ImportSourceKind;
  value: string;
}

export function isSpotifyPlaylistUrl(value: string): boolean {
  return value.includes('spotify.com/playlist/') || value.includes('open.spotify.com/playlist/');
}

export function isSpotifyAlbumUrl(value: string): boolean {
  return value.includes('spotify.com/album/') || value.includes('open.spotify.com/album/');
}

export function isSpotifyUrl(value: string): boolean {
  return isSpotifyPlaylistUrl(value) || isSpotifyAlbumUrl(value);
}

export function isYouTubeUrl(value: string): boolean {
  return value.includes('youtube.com/watch') || value.includes('youtu.be/') || value.includes('music.youtube.com');
}

export function isPlaintextSearch(value: string): boolean {
  return !value.includes('http') && value.trim().length > 2;
}

export function classifyImportSource(rawValue: string): ImportSource {
  const value = rawValue.trim();

  if (!value) {
    return { kind: 'invalid', value };
  }

  if (isSpotifyPlaylistUrl(value)) {
    return { kind: 'spotify-playlist', value };
  }

  if (isSpotifyAlbumUrl(value)) {
    return { kind: 'spotify-album', value };
  }

  if (isYouTubeUrl(value)) {
    return { kind: 'youtube', value };
  }

  if (isPlaintextSearch(value)) {
    return { kind: 'search', value };
  }

  return { kind: 'invalid', value };
}
