'use client';

import { MutableRefObject, useCallback } from 'react';
import { PlaylistWithSongs, Song } from '../lib/api';
import { useImport } from '../lib/useImport';
import { getImportStatusText, useSpotifyImport } from '../lib/useSpotifyImport';
import { UserPlaylist } from '../contexts/PlaylistContext';

interface UseImportManagerOptions {
  currentView: string;
  currentSongs: Song[];
  currentViewRef: MutableRefObject<string>;
  skipNextNameUpdate: MutableRefObject<boolean>;
  setCurrentPlaylistName: (name: string) => void;
  setCurrentView: (view: string) => void;
  setIsUrlBasedImport: (value: boolean) => void;
  setUrlForPersonalPlaylist: (playlistId: string) => void;
  clearSearch: () => void;
  refreshPlaylists: () => Promise<void>;
  loadPlaylist: (playlistId: string, isPublic?: boolean, publicUserId?: string, silent?: boolean) => Promise<PlaylistWithSongs>;
  setCurrentViewSongs: (songs: Song[]) => void;
  startFastPolling: (maxPolls?: number) => void;
  loadUserSongs: (silent?: boolean) => Promise<Song[]>;
  upsertPlaylist: (playlist: UserPlaylist) => void;
}

export function useImportManager({
  currentView,
  currentSongs,
  currentViewRef,
  skipNextNameUpdate,
  setCurrentPlaylistName,
  setCurrentView,
  setIsUrlBasedImport,
  setUrlForPersonalPlaylist,
  clearSearch,
  refreshPlaylists,
  loadPlaylist,
  setCurrentViewSongs,
  startFastPolling,
  loadUserSongs,
  upsertPlaylist,
}: UseImportManagerOptions) {
  const spotifyImport = useSpotifyImport(
    (playlistId, playlistName) => {
      upsertPlaylist({
        playlist_id: playlistId,
        playlist_name: playlistName,
        song_count: 0,
      });
      void refreshPlaylists();
      skipNextNameUpdate.current = true;
      setCurrentPlaylistName(playlistName);
      setUrlForPersonalPlaylist(playlistId);
      setCurrentView(playlistId);
      setIsUrlBasedImport(false);
    },
    async (playlistId) => {
      await refreshPlaylists();

      if (currentViewRef.current !== playlistId) return;

      try {
        const playlistData = await loadPlaylist(playlistId, false, undefined, true);
        if (currentViewRef.current !== playlistId) return;
        setCurrentViewSongs(playlistData.songs);
      } catch {
        // Keep background import refresh failures non-blocking.
      }
    },
  );

  const importProgress = getImportStatusText(spotifyImport.state);
  const startSpotifyImport = spotifyImport.startImport;

  const handleSpotifyUrl = useCallback((url: string) => {
    const shouldShowLoadingScreen = currentViewRef.current === 'user-songs';
    if (shouldShowLoadingScreen) {
      setIsUrlBasedImport(true);
    }

    void startSpotifyImport(url).then((result) => {
      if (!result && shouldShowLoadingScreen) {
        setIsUrlBasedImport(false);
      }
    }).catch(() => {
      if (shouldShowLoadingScreen) {
        setIsUrlBasedImport(false);
      }
    });
  }, [currentViewRef, setIsUrlBasedImport, startSpotifyImport]);

  const inlineImport = useImport({
    playlistId: currentView !== 'user-songs' && currentView !== 'discover' ? currentView : undefined,
    currentSongs,
    onSongsAdded: () => {
      if (currentView === 'user-songs') {
        void loadUserSongs();
      } else {
        void refreshPlaylists();
      }
      startFastPolling();
    },
    onSpotifyUrl: handleSpotifyUrl,
  });

  const handleSearchBarSubmit = useCallback(async (value: string) => {
    await inlineImport.doImport(value);
    clearSearch();
  }, [clearSearch, inlineImport]);

  return {
    spotifyImport,
    inlineImport,
    importProgress,
    handleSpotifyUrl,
    handleSearchBarSubmit,
  };
}
