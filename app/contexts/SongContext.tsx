'use client';

import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect, ReactNode } from 'react';
import { Song, PlaylistWithSongs, getSongs, getOwnedPlaylist, getPublicPlaylist, deleteSong, removeSongFromPlaylist, addToOfficialQueue } from '../lib/api';
import { getCurrentUserId as getAuthCurrentUserId } from '../lib/auth';

interface SongContextType {
  userSongs: Song[];
  setUserSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  currentViewSongs: Song[];
  setCurrentViewSongs: React.Dispatch<React.SetStateAction<Song[]>>;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  loadUserSongs: (silent?: boolean) => Promise<Song[]>;
  loadPlaylist: (playlistId: string, isPublic?: boolean, publicUserId?: string, silent?: boolean) => Promise<PlaylistWithSongs>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  completeSongs: Song[];
  processingSongs: Song[];
  handleDeleteSong: (e: React.MouseEvent, song: Song) => Promise<void>;
  handleRetrySong: (e: React.MouseEvent, song: Song) => Promise<void>;
  handleAddToQueue: (e: React.MouseEvent, song: Song, loadQueue: () => Promise<void>) => Promise<void>;
  lastMutationTime: React.MutableRefObject<number>;
  triggerFastPolling: number;
  fastPollMax: React.MutableRefObject<number>;
  startFastPolling: (maxPolls?: number) => void;
  addPendingDeletions: (ids: string[]) => void;
}

const SongContext = createContext<SongContextType | null>(null);

function songsAreEqual(a: Song[], b: Song[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const songA = a[i];
    const songB = b[i];

    if (
      songA.song_id !== songB.song_id ||
      songA.title !== songB.title ||
      songA.artist !== songB.artist ||
      songA.status !== songB.status ||
      songA.duration !== songB.duration ||
      songA.stream_url !== songB.stream_url ||
      songA.timestamp !== songB.timestamp ||
      songA.is_incorrect !== songB.is_incorrect ||
      songA.actual_id !== songB.actual_id
    ) {
      return false;
    }
  }

  return true;
}

export function useSongContext() {
  const ctx = useContext(SongContext);
  if (!ctx) throw new Error('useSongContext must be used within SongProvider');
  return ctx;
}

interface SongProviderProps {
  children: ReactNode;
  currentView: string;
}

export function SongProvider({ children, currentView }: SongProviderProps) {
  const [userSongsState, setUserSongsState] = useState<Song[]>([]);
  const [currentViewSongsState, setCurrentViewSongsState] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [triggerFastPolling, setTriggerFastPolling] = useState(0);
  const fastPollMax = useRef<number>(20);
  const lastMutationTime = useRef<number>(0);
  const pendingDeletions = useRef<Set<string>>(new Set());
  const pendingDeletionTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const addPendingDeletions = useCallback((ids: string[]) => {
    for (const id of ids) {
      pendingDeletions.current.add(id);
      // Clear any existing timer for this id
      const existing = pendingDeletionTimers.current.get(id);
      if (existing) clearTimeout(existing);
      // Auto-expire after 15 seconds
      const timer = setTimeout(() => {
        pendingDeletions.current.delete(id);
        pendingDeletionTimers.current.delete(id);
      }, 15000);
      pendingDeletionTimers.current.set(id, timer);
    }
  }, []);

  const filterPendingDeletions = useCallback((songs: Song[]) => {
    if (pendingDeletions.current.size === 0) return songs;
    return songs.filter(s => !pendingDeletions.current.has(s.song_id));
  }, []);

  const setUserSongs = useCallback((value: React.SetStateAction<Song[]>) => {
    setUserSongsState((previousSongs) => {
      const nextSongs = typeof value === 'function'
        ? (value as (songs: Song[]) => Song[])(previousSongs)
        : value;
      return songsAreEqual(previousSongs, nextSongs) ? previousSongs : nextSongs;
    });
  }, []);

  const setCurrentViewSongs = useCallback((value: React.SetStateAction<Song[]>) => {
    setCurrentViewSongsState((previousSongs) => {
      const nextSongs = typeof value === 'function'
        ? (value as (songs: Song[]) => Song[])(previousSongs)
        : value;
      return songsAreEqual(previousSongs, nextSongs) ? previousSongs : nextSongs;
    });
  }, []);

  const startFastPolling = useCallback((maxPolls: number = 20) => {
    fastPollMax.current = maxPolls;
    setTriggerFastPolling(prev => prev + 1);
  }, []);

  const loadUserSongs = useCallback(async (silent = false) => {
    const requestUserId = getAuthCurrentUserId();
    if (!requestUserId) {
      setUserSongs([]);
      return [];
    }

    if (!silent) setIsLoading(true);
    try {
      const songs = filterPendingDeletions(await getSongs());
      if (getAuthCurrentUserId() !== requestUserId) {
        return [];
      }

      setUserSongs(prevSongs => {
        if (prevSongs.length !== songs.length) return songs;
        if (prevSongs.length === 0 && songs.length === 0) return prevSongs;

        const hasChanges = songs.some(song => {
          const prevSong = prevSongs.find(p => p.song_id === song.song_id);
          return !prevSong ||
                 prevSong.status !== song.status ||
                 prevSong.title !== song.title;
        }) || prevSongs.some(prevSong => {
          return !songs.find(s => s.song_id === prevSong.song_id);
        });

        return hasChanges ? songs : prevSongs;
      });
      return songs;
    } catch (error) {
      console.error('Failed to load user songs:', error);
      return [];
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [filterPendingDeletions, setUserSongs]);

  const loadPlaylist = useCallback(async (playlistId: string, isPublic = false, publicUserId?: string, silent = false): Promise<PlaylistWithSongs> => {
    const requestUserId = !isPublic ? getAuthCurrentUserId() : null;
    if (!isPublic && !requestUserId) {
      return { playlist_id: playlistId, name: '', songs: [] };
    }
    const ownerUserId = requestUserId;

    if (!silent) setIsLoading(true);

    try {
      let playlist;
      if (isPublic && publicUserId) {
        playlist = await getPublicPlaylist(publicUserId, playlistId);
      } else {
        playlist = await getOwnedPlaylist(ownerUserId as string, playlistId);
      }
      if (requestUserId && getAuthCurrentUserId() !== requestUserId) {
        return { playlist_id: playlistId, name: '', songs: [] };
      }
      if (playlist.songs) {
        playlist.songs = filterPendingDeletions(playlist.songs);
      }
      return playlist;
    } catch (error) {
      console.error('Failed to load playlist:', error);
      return { playlist_id: playlistId, name: '', songs: [] };
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [filterPendingDeletions]);

  const completeSongs = useMemo(() => {
    const complete = currentViewSongsState.filter(song => song.status === 'COMPLETE');

    if (!searchQuery.trim()) return complete;

    const query = searchQuery.toLowerCase();
    return complete.filter(song => {
      const title = (song.title || `https://youtube.com/watch?v=${song.song_id}`).toLowerCase();
      return title.includes(query);
    });
  }, [currentViewSongsState, searchQuery]);

  const processingSongs = useMemo(() => {
    if (currentView === 'user-songs') {
      return userSongsState.filter(song => song.status !== 'COMPLETE');
    } else {
      return currentViewSongsState.filter(song => song.status !== 'COMPLETE');
    }
  }, [currentView, userSongsState, currentViewSongsState]);

  const handleDeleteSong = useCallback(async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    lastMutationTime.current = Date.now();

    // Optimistic: update UI immediately, protect from poll flicker
    addPendingDeletions([song.song_id]);
    if (currentView === 'user-songs') {
      const updatedUserSongs = userSongsState.filter(s => s.song_id !== song.song_id);
      setUserSongs(updatedUserSongs);
      setCurrentViewSongs(updatedUserSongs);
    } else {
      const updatedViewSongs = currentViewSongsState.filter(s => s.song_id !== song.song_id);
      setCurrentViewSongs(updatedViewSongs);
    }

    try {
      if (currentView === 'user-songs') {
        await deleteSong(song.song_id);
      } else {
        await removeSongFromPlaylist(currentView, song.song_id);
      }
      lastMutationTime.current = Date.now();
      startFastPolling(5);
    } catch (err) {
      console.error('Failed to delete song:', err);
      // Revert on failure
      pendingDeletions.current.delete(song.song_id);
      await loadUserSongs();
    }
  }, [addPendingDeletions, currentView, currentViewSongsState, loadUserSongs, setCurrentViewSongs, setUserSongs, startFastPolling, userSongsState]);

  const handleRetrySong = useCallback(async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();

    try {
      const { addSong } = await import('../lib/api');
      await addSong(`https://www.youtube.com/watch?v=${song.song_id}`, song.title, song.artist);

      setTimeout(async () => {
        await loadUserSongs();
        startFastPolling();
      }, 1000);
    } catch (err) {
      console.error('Failed to retry song:', err);
    }
  }, [loadUserSongs, startFastPolling]);

  const handleAddToQueue = useCallback(async (e: React.MouseEvent, song: Song, loadQueue: () => Promise<void>) => {
    e.stopPropagation();

    try {
      await addToOfficialQueue([song.song_id]);
      await loadQueue();
    } catch (err) {
      console.error('Failed to add song to queue:', err);
    }
  }, []);

  const value: SongContextType = {
    userSongs: userSongsState, setUserSongs,
    currentViewSongs: currentViewSongsState, setCurrentViewSongs,
    isLoading, setIsLoading,
    loadUserSongs, loadPlaylist,
    searchQuery, setSearchQuery,
    completeSongs, processingSongs,
    handleDeleteSong, handleRetrySong, handleAddToQueue,
    lastMutationTime,
    triggerFastPolling, fastPollMax, startFastPolling,
    addPendingDeletions,
  };

  return (
    <SongContext.Provider value={value}>
      {children}
    </SongContext.Provider>
  );
}
