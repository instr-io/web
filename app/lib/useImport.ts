'use client';

import { useState, useCallback } from 'react';
import { addSong, updatePlaylist, Song } from './api';
import { createHeaders } from './api/client';
import { getCurrentUserId } from './auth';
import { buildApiUrl } from './env';
import { classifyImportSource } from './importSource';
import {
  searchYouTubeForTrack,
  searchYouTubeForQuery,
} from './youtube';

export type ImportStatus = {
  message: string;
  type: 'info' | 'success' | 'error';
} | null;

interface UseImportOptions {
  /** If provided, newly added songs get appended to this playlist */
  playlistId?: string;
  currentSongs?: Song[];
  onSongsAdded?: () => void;
  /** Called for Spotify URLs that need the full state machine */
  onSpotifyUrl?: (url: string) => void;
  onDone?: () => void;
}

export function useImport(options: UseImportOptions = {}) {
  const { playlistId, currentSongs, onSongsAdded, onSpotifyUrl, onDone } = options;
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<ImportStatus>(null);

  const clearStatus = useCallback((delay = 3000) => {
    setTimeout(() => setStatus(null), delay);
  }, []);

  const addToPlaylist = useCallback(async (songId: string) => {
    if (!playlistId || !currentSongs) return;
    const currentSongIds = currentSongs.map((song) => song.song_id);
    await updatePlaylist(playlistId, [...currentSongIds, songId]);
  }, [currentSongs, playlistId]);

  const handleYouTubeLink = useCallback(async (url: string) => {
    setIsImporting(true);
    setStatus({ message: 'Adding...', type: 'info' });
    try {
      // Fetch channel via oEmbed so the backend cleaner can use it as context.
      let channel = '';
      try {
        const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          channel = oembed.author_name || '';
        }
      } catch { /* fall through with empty metadata */ }

      const result = await addSong(url, undefined, undefined, channel || undefined);
      if (result) {
        await addToPlaylist(result.song_id);
        setStatus({ message: 'Added', type: 'success' });
        onSongsAdded?.();
        onDone?.();
      }
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : 'Failed', type: 'error' });
    } finally {
      setIsImporting(false);
      clearStatus();
    }
  }, [addToPlaylist, clearStatus, onDone, onSongsAdded]);

  const handlePlaintextSearch = useCallback(async (input: string) => {
    setIsImporting(true);
    setStatus({ message: `Searching "${input}"`, type: 'info' });
    try {
      const searchResult = await searchYouTubeForQuery(input);
      if (searchResult && searchResult.id) {
        setStatus({ message: 'Adding...', type: 'info' });
        const songData = await addSong(searchResult.url, undefined, undefined, searchResult.channel);
        if (songData?.song_id) {
          await addToPlaylist(songData.song_id);
          setStatus({ message: 'Added', type: 'success' });
          onSongsAdded?.();
          onDone?.();
        } else {
          throw new Error('Failed');
        }
      } else {
        setStatus({ message: 'No results found', type: 'error' });
      }
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : 'Failed', type: 'error' });
    } finally {
      setIsImporting(false);
      clearStatus();
    }
  }, [addToPlaylist, clearStatus, onDone, onSongsAdded]);

  const handleSpotifyPlaylist = useCallback(async (url: string) => {
    setIsImporting(true);
    setStatus({ message: 'Importing playlist...', type: 'info' });
    try {
      const userId = getCurrentUserId();
      if (!userId) throw new Error('Sign in required');

      const currentSongTitles = (currentSongs || []).map((song) => song.title);

      const response = await fetch(buildApiUrl('/spotify/convert'), {
        method: 'POST',
        headers: await createHeaders(),
        body: JSON.stringify({
          url,
          user_id: userId,
          playlist_id: playlistId || '',
          exclude_song_titles: currentSongTitles,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
          throw new Error(errorData.error || 'Daily conversion limit reached. Come back tomorrow!');
        }
        throw new Error(errorData.error || 'Failed to convert Spotify playlist');
      }

      const result = await response.json();
      const existingSongIds: string[] = result.existing_song_ids || [];

      if ((!result.tracks || result.tracks.length === 0) && existingSongIds.length === 0) {
        setStatus({ message: 'No tracks found', type: 'info' });
        clearStatus();
        return;
      }

      const currentSongIds = (currentSongs || []).map((song) => song.song_id);
      const addedSongIds = [...currentSongIds];
      for (const songId of existingSongIds) {
        if (!addedSongIds.includes(songId)) {
          addedSongIds.push(songId);
        }
      }

      let successCount = existingSongIds.length;
      let failCount = 0;

      for (let i = 0; i < result.tracks.length; i++) {
        const track = result.tracks[i];
        const totalCount = (typeof result?.stats?.total === 'number' ? result.stats.total : result.tracks.length);
        setStatus({ message: `${existingSongIds.length + i + 1}/${totalCount} ${track.artist} — ${track.title}`, type: 'info' });

        try {
          const ytResult = await searchYouTubeForTrack(track.artist, track.title);
          if (ytResult) {
            const songData = await addSong(ytResult.url, track.title, track.artist, ytResult.channel);
            if (songData?.song_id) {
              addedSongIds.push(songData.song_id);
              successCount++;
            } else { failCount++; }
          } else { failCount++; }
        } catch { failCount++; }
      }

      if (playlistId && addedSongIds.length > currentSongIds.length) {
        await updatePlaylist(playlistId, addedSongIds);
      }

      if (successCount > 0) {
        setStatus({ message: `Added ${successCount}${failCount > 0 ? `, ${failCount} failed` : ''}`, type: 'success' });
        onSongsAdded?.();
        onDone?.();
      } else {
        setStatus({ message: `${failCount} tracks not found`, type: 'error' });
      }
    } catch (err) {
      setStatus({ message: err instanceof Error ? err.message : 'Import failed', type: 'error' });
    } finally {
      setIsImporting(false);
      clearStatus(5000);
    }
  }, [clearStatus, currentSongs, onDone, onSongsAdded, playlistId]);

  const doImport = useCallback(async (input: string) => {
    const source = classifyImportSource(input);
    if (source.kind === 'invalid' || isImporting) return;

    if (source.kind === 'spotify-playlist' || source.kind === 'spotify-album') {
      if (onSpotifyUrl) {
        onSpotifyUrl(source.value);
        return;
      }
      await handleSpotifyPlaylist(source.value);
    } else if (source.kind === 'youtube') {
      await handleYouTubeLink(source.value);
    } else if (source.kind === 'search') {
      await handlePlaintextSearch(source.value);
    }
  }, [handlePlaintextSearch, handleSpotifyPlaylist, handleYouTubeLink, isImporting, onSpotifyUrl]);

  return { doImport, isImporting, status, setStatus };
}
