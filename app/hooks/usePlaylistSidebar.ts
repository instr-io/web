'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createPlaylist, deletePlaylist, sharePlaylist } from '../lib/api';
import { getCurrentUserId, subscribeToAuth } from '../lib/auth';
import { shareToClipboard } from '../lib/share';
import { usePlaylistContext } from '../contexts/PlaylistContext';

interface UsePlaylistSidebarOptions {
  sidebarSearchQuery?: string;
  onPlaylistCreated?: (playlistId: string, playlistName: string, songIds?: string[]) => void;
  onPlaylistDeleted?: () => void;
  showPopup: (message: string, duration?: number) => void;
}

export function usePlaylistSidebar({
  sidebarSearchQuery = '',
  onPlaylistCreated,
  onPlaylistDeleted,
  showPopup,
}: UsePlaylistSidebarOptions) {
  const { userPlaylists: playlists, loadPlaylists: loadPlaylistsFromContext } = usePlaylistContext();
  const lastAuthUserId = useRef<string | null>(getCurrentUserId());
  const normalizedSidebarSearchQuery = sidebarSearchQuery.trim().toLowerCase();

  const visiblePlaylists = useMemo(() => {
    if (!normalizedSidebarSearchQuery) return playlists;
    return playlists.filter((playlist) =>
      (playlist.playlist_name || '').toLowerCase().includes(normalizedSidebarSearchQuery)
    );
  }, [normalizedSidebarSearchQuery, playlists]);

  const loadPlaylists = useCallback(async (forceRefresh = false) => {
    try {
      await loadPlaylistsFromContext(forceRefresh);
    } catch (err) {
      console.error('Failed to load playlists:', err);
    }
  }, [loadPlaylistsFromContext]);

  useEffect(() => {
    loadPlaylists();

    const unsubscribe = subscribeToAuth((authState) => {
      const nextUserId = authState.user?.id || null;
      if (nextUserId !== lastAuthUserId.current) {
        lastAuthUserId.current = nextUserId;
        loadPlaylists(true);
      }
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadPlaylists]);

  const handleCreateBlankPlaylist = useCallback(async () => {
    try {
      const result = await createPlaylist('Untitled Playlist', []);
      const playlist = result?.playlist;
      if (playlist && onPlaylistCreated) {
        onPlaylistCreated(playlist.playlist_id, playlist.playlist_name);
      }
    } catch (err) {
      console.error('Failed to create playlist:', err);
    }
  }, [onPlaylistCreated]);

  const handleDeletePlaylist = useCallback(async (event: React.MouseEvent, playlistId: string) => {
    event.stopPropagation();

    try {
      await deletePlaylist(playlistId);
      await loadPlaylists(true);
      onPlaylistDeleted?.();
    } catch (err) {
      console.error('Failed to delete playlist:', err);
    }
  }, [loadPlaylists, onPlaylistDeleted]);

  const handleSharePlaylist = useCallback(async (event: React.MouseEvent, playlistId: string, originalUserId?: string) => {
    event.stopPropagation();

    let shareUrl: string;
    try {
      const result = await sharePlaylist(playlistId);
      shareUrl = `${window.location.origin}${result.share_url}`;
    } catch (err) {
      const currentUserId = getCurrentUserId();
      const userId = originalUserId || currentUserId || 'user';
      shareUrl = `${window.location.origin}?playlist=${userId}:${playlistId}`;
    }

    await shareToClipboard(shareUrl, showPopup);
  }, [showPopup]);

  return {
    normalizedSidebarSearchQuery,
    visiblePlaylists,
    handleCreateBlankPlaylist,
    handleDeletePlaylist,
    handleSharePlaylist,
  };
}
