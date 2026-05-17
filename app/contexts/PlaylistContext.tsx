'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { getUserPlaylists, addSongsToPlaylist as addSongsToPlaylistAPI, createPlaylist } from '../lib/api';
import type { UserPlaylist as ApiUserPlaylist } from '../lib/api/types';
import { getCurrentUserId as getAuthCurrentUserId } from '../lib/auth';

export type UserPlaylist = ApiUserPlaylist;

interface PlaylistContextType {
  userPlaylists: UserPlaylist[];
  loadPlaylists: (forceRefresh?: boolean) => Promise<UserPlaylist[]>;
  replacePlaylists: (playlists: UserPlaylist[]) => void;
  clearPlaylists: () => void;
  upsertPlaylist: (playlist: UserPlaylist) => void;
  addSongsToPlaylist: (playlistId: string, songIds: string[]) => Promise<void>;
  createPlaylistWithSongs: (name: string, songIds: string[]) => Promise<string>;
}

const PlaylistContext = createContext<PlaylistContextType | null>(null);

function playlistsAreEqual(a: UserPlaylist[], b: UserPlaylist[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const playlistA = a[i];
    const playlistB = b[i];

    if (
      playlistA.playlist_id !== playlistB.playlist_id ||
      playlistA.playlist_name !== playlistB.playlist_name ||
      playlistA.song_count !== playlistB.song_count ||
      playlistA.original_user_id !== playlistB.original_user_id ||
      playlistA.artist_name !== playlistB.artist_name
    ) {
      return false;
    }
  }

  return true;
}

export function usePlaylistContext() {
  const ctx = useContext(PlaylistContext);
  if (!ctx) throw new Error('usePlaylistContext must be used within PlaylistProvider');
  return ctx;
}

export function PlaylistProvider({ children }: { children: ReactNode }) {
  const [userPlaylistsState, setUserPlaylistsState] = useState<UserPlaylist[]>([]);
  const latestLoadRequestId = useRef(0);

  const sortPlaylists = useCallback((playlists: UserPlaylist[]) => {
    return [...playlists]
      .filter((playlist) => playlist.playlist_name && playlist.playlist_name.trim())
      .sort((a, b) => (a.playlist_name || '').localeCompare(b.playlist_name || ''));
  }, []);

  const replacePlaylists = useCallback((playlists: UserPlaylist[]) => {
    const sortedPlaylists = sortPlaylists(playlists);
    setUserPlaylistsState((existingPlaylists) =>
      playlistsAreEqual(existingPlaylists, sortedPlaylists) ? existingPlaylists : sortedPlaylists
    );
  }, [sortPlaylists]);

  const clearPlaylists = useCallback(() => {
    setUserPlaylistsState((existingPlaylists) => existingPlaylists.length === 0 ? existingPlaylists : []);
  }, []);

  const upsertPlaylist = useCallback((playlist: UserPlaylist) => {
    setUserPlaylistsState((existingPlaylists) => {
      const existingIndex = existingPlaylists.findIndex(
        (existingPlaylist) => existingPlaylist.playlist_id === playlist.playlist_id
      );
      const nextPlaylists = [...existingPlaylists];

      if (existingIndex === -1) {
        nextPlaylists.push(playlist);
      } else {
        nextPlaylists[existingIndex] = {
          ...nextPlaylists[existingIndex],
          ...playlist,
          song_count: Math.max(nextPlaylists[existingIndex].song_count ?? 0, playlist.song_count ?? 0),
        };
      }

      const sortedPlaylists = sortPlaylists(nextPlaylists);
      return playlistsAreEqual(existingPlaylists, sortedPlaylists) ? existingPlaylists : sortedPlaylists;
    });
  }, [sortPlaylists]);

  const loadPlaylists = useCallback(async (forceRefresh = false) => {
    const requestId = ++latestLoadRequestId.current;
    const requestUserId = getAuthCurrentUserId();

    if (!requestUserId) {
      clearPlaylists();
      return [];
    }

    try {
      const result = await getUserPlaylists(forceRefresh);
      if (getAuthCurrentUserId() !== requestUserId) {
        return [];
      }

      const playlists = result?.playlists && Array.isArray(result.playlists) ? sortPlaylists(result.playlists) : [];

      if (requestId === latestLoadRequestId.current) {
        replacePlaylists(playlists);
      }

      return playlists;
    } catch (err) {
      console.error('Failed to load playlists:', err);

      if (requestId === latestLoadRequestId.current) {
        clearPlaylists();
      }

      return [];
    }
  }, [clearPlaylists, replacePlaylists, sortPlaylists]);

  const addSongsToPlaylist = useCallback(async (playlistId: string, songIds: string[]) => {
    await addSongsToPlaylistAPI(playlistId, songIds);
  }, []);

  const createPlaylistWithSongs = useCallback(async (name: string, songIds: string[]) => {
    const result = await createPlaylist(name, songIds);
    return result.playlist.playlist_id as string;
  }, []);

  const value: PlaylistContextType = {
    userPlaylists: userPlaylistsState,
    loadPlaylists,
    replacePlaylists,
    clearPlaylists,
    upsertPlaylist,
    addSongsToPlaylist,
    createPlaylistWithSongs,
  };

  return (
    <PlaylistContext.Provider value={value}>
      {children}
    </PlaylistContext.Provider>
  );
}
