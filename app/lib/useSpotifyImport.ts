'use client';

import { useState, useCallback, useRef } from 'react';
import { createPlaylist, addSong, addSongsToPlaylist } from './api';
import { createHeaders } from './api/client';
import { searchYouTubeForTrack } from './youtube';
import { getCurrentUserId } from './auth';
import { buildApiUrl } from './env';
import { isSpotifyAlbumUrl } from './importSource';

type ImportState =
  | { status: 'idle' }
  | { status: 'fetching_spotify'; url: string }
  | { status: 'creating_playlist'; playlistName: string; trackCount: number }
  | { status: 'importing'; playlistId: string; playlistName: string; current: number; total: number; currentTrack: string }
  | { status: 'complete'; playlistId: string; playlistName: string; successCount: number; totalCount: number }
  | { status: 'error'; message: string };

interface SpotifyTrack {
  artist: string;
  title: string;
}

interface UseSpotifyImportResult {
  state: ImportState;
  startImport: (url: string) => Promise<{ playlistId: string; playlistName: string } | null>;
  reset: () => void;
  isImporting: boolean;
}

export function useSpotifyImport(
  onPlaylistCreated?: (playlistId: string, playlistName: string, songIds?: string[]) => void,
  onSongsUpdated?: (playlistId: string) => void
): UseSpotifyImportResult {
  const [state, setState] = useState<ImportState>({ status: 'idle' });
  const abortRef = useRef(false);
  const importingRef = useRef(false);

  const reset = useCallback(() => {
    abortRef.current = true;
    importingRef.current = false;
    setState({ status: 'idle' });
  }, []);

  const scheduleReset = useCallback((delay = 5000) => {
    setTimeout(() => {
      if (!abortRef.current) {
        setState({ status: 'idle' });
      }
    }, delay);
  }, []);

  const startImport = useCallback(async (url: string): Promise<{ playlistId: string; playlistName: string } | null> => {
    // Prevent duplicate imports
    if (importingRef.current) return null;
    importingRef.current = true;
    abortRef.current = false;

    // Wait for auth
    for (let i = 0; i < 50; i++) {
      if (getCurrentUserId()) break;
      await new Promise(r => setTimeout(r, 100));
    }

    if (!getCurrentUserId()) {
      importingRef.current = false;
      setState({ status: 'error', message: 'Authentication required' });
      return null;
    }

    setState({ status: 'fetching_spotify', url });

    try {
      // Detect if it's an album or playlist and use appropriate endpoint
      const isAlbum = isSpotifyAlbumUrl(url);
      const endpoint = isAlbum
        ? buildApiUrl('/spotify/album/convert')
        : buildApiUrl('/spotify/convert');

      // Fetch Spotify data
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: await createHeaders(),
        body: JSON.stringify({ url, user_id: getCurrentUserId() }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(errorData.error || 'Daily conversion limit reached. Come back tomorrow!');
        }
        throw new Error(errorData.error || `Failed to fetch Spotify ${isAlbum ? 'album' : 'playlist'}`);
      }

      const result = await response.json();
      const tracks: SpotifyTrack[] = result.tracks || [];
      const existingSongIds: string[] = result.existing_song_ids || [];
      const playlistName = result.playlist || result.name || (isAlbum ? 'Imported Album' : 'Imported Playlist');
      const totalSourceTracks = typeof result?.stats?.total === 'number' ? result.stats.total : tracks.length;

      if (tracks.length === 0 && existingSongIds.length === 0) {
        importingRef.current = false;
        const hasSourceTracks = totalSourceTracks > 0;

        setState({ status: 'error', message: 'No tracks found' });
        scheduleReset();
        return null;
      }

      if (abortRef.current) return null;

      // Create playlist
      setState({ status: 'creating_playlist', playlistName, trackCount: totalSourceTracks });

      const playlistResult = await createPlaylist(playlistName, existingSongIds);
      const playlistId = playlistResult.playlist.playlist_id;

      if (abortRef.current) return null;

      // Notify that playlist was created - this triggers navigation
      onPlaylistCreated?.(playlistId, playlistName, existingSongIds);

      // Start importing tracks
      let successCount = existingSongIds.length;
      const batchSize = 5;
      let pendingSongIds: string[] = [];

      if (tracks.length === 0) {
        importingRef.current = false;
        setState({
          status: 'complete',
          playlistId,
          playlistName,
          successCount,
          totalCount: totalSourceTracks
        });
        scheduleReset();
        return { playlistId, playlistName };
      }

      for (let i = 0; i < tracks.length; i++) {
        if (abortRef.current) break;

        const track = tracks[i];
        setState({
          status: 'importing',
          playlistId,
          playlistName,
          current: existingSongIds.length + i + 1,
          total: totalSourceTracks,
          currentTrack: `${track.artist} - ${track.title}`
        });

        try {
          const youtubeResult = await searchYouTubeForTrack(track.artist, track.title);
          if (youtubeResult) {
            const songData = await addSong(youtubeResult.url, track.title, track.artist, youtubeResult.channel);
            if (songData?.song_id) {
              pendingSongIds.push(songData.song_id);
              successCount++;

              // Batch add to playlist
              if (pendingSongIds.length >= batchSize || i === tracks.length - 1) {
                await addSongsToPlaylist(playlistId, pendingSongIds).catch(console.error);
                pendingSongIds = [];
                onSongsUpdated?.(playlistId);
              }
            }
          }
        } catch (e) {
          console.error(`Failed to import: ${track.title}`, e);
        }
      }

      // Final batch
      if (pendingSongIds.length > 0) {
        await addSongsToPlaylist(playlistId, pendingSongIds).catch(console.error);
        onSongsUpdated?.(playlistId);
      }

      setState({
        status: 'complete',
        playlistId,
        playlistName,
        successCount,
        totalCount: totalSourceTracks
      });

      importingRef.current = false;
      scheduleReset();

      return { playlistId, playlistName };

    } catch (error) {
      importingRef.current = false;
      setState({ status: 'error', message: error instanceof Error ? error.message : 'Import failed' });
      return null;
    }
  }, [onPlaylistCreated, onSongsUpdated, scheduleReset]);

  const isImporting = state.status === 'fetching_spotify' ||
                      state.status === 'creating_playlist' ||
                      state.status === 'importing';

  return { state, startImport, reset, isImporting };
}

// Helper to get display text from state
export function getImportStatusText(state: ImportState): string {
  switch (state.status) {
    case 'idle':
      return '';
    case 'fetching_spotify':
      // Detect album vs playlist from URL
      const isAlbum = state.url.includes('album');
      return `Fetching Spotify ${isAlbum ? 'album' : 'playlist'}...`;
    case 'creating_playlist':
      return `Creating playlist "${state.playlistName}"...`;
    case 'importing':
      return `Found ${state.current}/${state.total}: ${state.currentTrack}`;
    case 'complete':
      return `Imported ${state.successCount}/${state.totalCount} songs`;
    case 'error':
      return state.message;
  }
}
