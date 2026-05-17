'use client';

import { MutableRefObject, useEffect } from 'react';
import { AuthState, initializeAuth, subscribeToAuth } from '../lib/auth';
import { PlaylistWithSongs, QueueItem, Song } from '../lib/api';
import { UserPlaylist } from '../contexts/PlaylistContext';

interface LifecyclePlaybackController {
  currentSong?: Song;
  loadPlaybackState: () => Promise<void>;
  loadQueue: () => Promise<void>;
  onQueueExhaustedRef: MutableRefObject<(() => void) | null>;
  setCurrentSong: (song: Song | undefined) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setLocalSongList: (songs: Song[], currentIndex: number) => void;
  setQueue: (queue: QueueItem[]) => void;
}

interface LifecycleSongsController {
  completeSongs: Song[];
  fastPollMax: MutableRefObject<number>;
  lastMutationTime: MutableRefObject<number>;
  loadPlaylist: (playlistId: string, isPublic?: boolean, publicUserId?: string, silent?: boolean) => Promise<PlaylistWithSongs>;
  loadUserSongs: (silent?: boolean) => Promise<Song[]>;
  setCurrentViewSongs: (songs: Song[]) => void;
  setUserSongs: (songs: Song[]) => void;
  triggerFastPolling: number;
  userSongs: Song[];
}

interface UseHomeLifecycleOptions {
  currentView: string;
  currentViewRef: MutableRefObject<string>;
  userId: string | null;
  setUserId: (userId: string | null) => void;
  currentAuthUserIdRef: MutableRefObject<string | null>;
  isInitialLoad: boolean;
  setIsInitialLoad: (value: boolean) => void;
  isSharedPlaylist: boolean;
  sharedPlaylistUserId: string | null;
  sharedPlaylistId: string | null;
  sortedCompleteSongs: Song[];
  userPlaylists: UserPlaylist[];
  replaceUrl: (url: string) => void;
  clearPlaylists: () => void;
  setIsViewLoading: (value: boolean) => void;
  setCurrentView: (view: string) => void;
  setCurrentPlaylistName: (name: string) => void;
  setCurrentArtistName: (name: string | null) => void;
  playback: LifecyclePlaybackController;
  songs: LifecycleSongsController;
  spotifyImportIsImporting: boolean;
}

export function useHomeLifecycle({
  currentView,
  currentViewRef,
  userId,
  setUserId,
  currentAuthUserIdRef,
  isInitialLoad,
  setIsInitialLoad,
  isSharedPlaylist,
  sharedPlaylistUserId,
  sharedPlaylistId,
  sortedCompleteSongs,
  userPlaylists,
  replaceUrl,
  clearPlaylists,
  setIsViewLoading,
  setCurrentView,
  setCurrentPlaylistName,
  setCurrentArtistName,
  playback,
  songs,
  spotifyImportIsImporting,
}: UseHomeLifecycleOptions) {
  const {
    currentSong,
    loadPlaybackState,
    loadQueue,
    onQueueExhaustedRef,
    setCurrentSong,
    setIsPlaying,
    setLocalSongList,
    setQueue,
  } = playback;
  const {
    fastPollMax,
    lastMutationTime,
    loadPlaylist,
    loadUserSongs,
    setCurrentViewSongs,
    setUserSongs,
    triggerFastPolling,
    userSongs,
  } = songs;

  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView, currentViewRef]);

  useEffect(() => {
    currentAuthUserIdRef.current = userId;
  }, [currentAuthUserIdRef, userId]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initAuth = async () => {
      try {
        unsubscribe = subscribeToAuth((authState: AuthState) => {
          const previousUserId = currentAuthUserIdRef.current;
          const newUserId = authState.user?.id || null;

          if (previousUserId !== newUserId) {
            const hadPreviousUser = previousUserId !== null;

            if (hadPreviousUser) {
              setUserSongs([]);
              setCurrentViewSongs([]);
              setCurrentPlaylistName('');
              clearPlaylists();
              setCurrentSong(undefined);
              setIsPlaying(false);
              setQueue([]);

              const isPrivateView =
                currentViewRef.current !== 'discover' &&
                currentViewRef.current !== 'stats' &&
                currentViewRef.current !== 'model' &&
                !currentViewRef.current.startsWith('shared:');

              if (isPrivateView) {
                setCurrentView('user-songs');
                replaceUrl('/');
              }
            }

            currentAuthUserIdRef.current = newUserId;
            setUserId(newUserId);
          }
        });
        initializeAuth();
      } catch (error) {
        console.error('Failed to initialize auth', error);
      }
    };

    void initAuth();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [clearPlaylists, currentAuthUserIdRef, currentViewRef, replaceUrl, setCurrentPlaylistName, setCurrentView, setCurrentSong, setCurrentViewSongs, setIsPlaying, setQueue, setUserId, setUserSongs]);

  useEffect(() => {
    if (!isSharedPlaylist) return;

    const effectViewId = currentView;
    let cancelled = false;

    const loadSharedData = async () => {
      if (!sharedPlaylistUserId || !sharedPlaylistId) {
        setIsViewLoading(false);
        return;
      }

      setIsViewLoading(true);
      try {
        const playlist = await loadPlaylist(sharedPlaylistId, true, sharedPlaylistUserId);
        if (cancelled || currentViewRef.current !== effectViewId) return;
        setCurrentViewSongs(playlist.songs);
        setCurrentArtistName(null);
        setCurrentPlaylistName(playlist.name);
      } catch (error) {
        console.error('Failed to load shared playlist:', error);
      } finally {
        if (!cancelled && currentViewRef.current === effectViewId) {
          setIsViewLoading(false);
        }
      }
    };

    void loadSharedData();
    return () => {
      cancelled = true;
    };
  }, [currentView, currentViewRef, isSharedPlaylist, loadPlaylist, setCurrentArtistName, setCurrentPlaylistName, setCurrentViewSongs, setIsViewLoading, sharedPlaylistId, sharedPlaylistUserId]);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    const loadInitialData = async () => {
      try {
        await loadPlaybackState();
        const loadedSongs = await loadUserSongs();
        await loadQueue();

        if (!cancelled && loadedSongs.length === 0 && currentViewRef.current === 'user-songs' && isInitialLoad) {
          setCurrentView('discover');
        }
      } finally {
        if (!cancelled) {
          setIsInitialLoad(false);
        }
      }
    };

    void loadInitialData();
    return () => {
      cancelled = true;
    };
  }, [currentViewRef, isInitialLoad, loadPlaybackState, loadQueue, loadUserSongs, setCurrentView, setIsInitialLoad, userId]);

  useEffect(() => {
    if (!userId || currentView === 'discover' || currentView === 'stats' || currentView === 'model') {
      return;
    }

    const effectViewId = currentView;
    let intervalId: NodeJS.Timeout | null = null;
    let fastPollCount = 0;
    const maxFastPolls = fastPollMax.current;
    const fastInterval = 10_000;
    const slowInterval = 60_000;
    let cancelled = false;

    const pollForUpdates = async (): Promise<boolean> => {
      if (spotifyImportIsImporting) return true;
      if (document.hidden) return true;

      const mutationTimeAtStart = lastMutationTime.current;
      let inProgressSongs: Song[] = [];

      if (effectViewId === 'user-songs') {
        const freshUserSongs = await loadUserSongs(true);
        if (cancelled || currentViewRef.current !== effectViewId || lastMutationTime.current > mutationTimeAtStart) return false;
        setCurrentViewSongs(freshUserSongs);
        inProgressSongs = freshUserSongs.filter((song) => song.status !== 'ERROR' && song.status !== 'COMPLETE');
      } else if (!effectViewId.startsWith('shared:')) {
        try {
          const knownPlaylist = userPlaylists.find((playlist) => playlist.playlist_id === effectViewId);
          const publicUserId = knownPlaylist?.original_user_id;
          const playlistData = await loadPlaylist(effectViewId, Boolean(publicUserId), publicUserId, true);
          if (cancelled || currentViewRef.current !== effectViewId || lastMutationTime.current > mutationTimeAtStart) return false;
          setCurrentViewSongs(playlistData.songs);
          inProgressSongs = playlistData.songs.filter((song: Song) => song.status !== 'ERROR' && song.status !== 'COMPLETE');
        } catch (error) {
          console.error('Failed to reload playlist during polling:', error);
          inProgressSongs = [];
        }
      } else {
        return false;
      }

      return inProgressSongs.length > 0;
    };

    const scheduleNext = (hasProcessing: boolean) => {
      if (cancelled || !hasProcessing) return;

      fastPollCount += 1;
      const delay = fastPollCount <= maxFastPolls ? fastInterval : slowInterval;

      intervalId = setTimeout(async () => {
        if (cancelled) return;
        const stillProcessing = await pollForUpdates();
        scheduleNext(stillProcessing);
      }, delay);
    };

    void (async () => {
      const hasProcessing = await pollForUpdates();
      scheduleNext(hasProcessing);
    })();

    return () => {
      cancelled = true;
      if (intervalId) clearTimeout(intervalId);
    };
  }, [currentView, currentViewRef, fastPollMax, lastMutationTime, loadPlaylist, loadUserSongs, setCurrentViewSongs, spotifyImportIsImporting, triggerFastPolling, userId, userPlaylists]);

  useEffect(() => {
    if (!userId || currentView === 'discover' || currentView === 'stats' || currentView === 'model') return;

    const effectViewId = currentView;
    let cancelled = false;

    const loadViewData = async () => {
      if (effectViewId === 'user-songs') {
        let songsToShow = userSongs;
        if (userSongs.length === 0) {
          setIsViewLoading(true);
          songsToShow = await loadUserSongs();
        }
        if (cancelled || currentViewRef.current !== effectViewId) return;
        setCurrentViewSongs(songsToShow);
        setCurrentArtistName(null);
        setCurrentPlaylistName('');
        setIsViewLoading(false);
        return;
      }

      if (effectViewId.startsWith('shared:')) {
        return;
      }

      try {
        setIsViewLoading(true);
        const knownPlaylist = userPlaylists.find((playlist) => playlist.playlist_id === effectViewId);
        const publicUserId = knownPlaylist?.original_user_id;
        const playlistData = await loadPlaylist(effectViewId, Boolean(publicUserId), publicUserId);
        if (cancelled || currentViewRef.current !== effectViewId) return;

        if (playlistData.artist_name) {
          setCurrentArtistName(playlistData.artist_name);
          setCurrentView('discover');
          setCurrentPlaylistName('');
          replaceUrl(`?artist=${encodeURIComponent(playlistData.artist_name)}`);
          return;
        }

        setCurrentViewSongs(playlistData.songs);
        setCurrentArtistName(null);
        if (playlistData.name) {
          setCurrentPlaylistName(playlistData.name);
        }
      } catch (error) {
        console.error('Failed to load playlist:', error);
        setCurrentViewSongs([]);
        setCurrentPlaylistName('');
      } finally {
        if (!cancelled && currentViewRef.current === effectViewId) {
          setIsViewLoading(false);
        }
      }
    };

    void loadViewData();
    return () => {
      cancelled = true;
    };
  }, [currentView, currentViewRef, loadPlaylist, loadUserSongs, replaceUrl, setCurrentArtistName, setCurrentPlaylistName, setCurrentView, setCurrentViewSongs, setIsViewLoading, userId, userPlaylists, userSongs]);

  useEffect(() => {
    onQueueExhaustedRef.current = () => {
      const view = currentViewRef.current;
      const completeSongs = sortedCompleteSongs;
      if (completeSongs.length === 0) return;

      const currentIndex = currentSong
        ? completeSongs.findIndex((song) => song.song_id === currentSong.song_id)
        : -1;

      setLocalSongList(completeSongs, currentIndex !== -1 ? currentIndex : 0);

      const source = view === 'user-songs' ? 'user-songs' : `playlist:${view}`;
      void import('../lib/api')
        .then(({ setPlaybackSource }) => setPlaybackSource(source))
        .catch(() => {});
    };

    return () => {
      onQueueExhaustedRef.current = null;
    };
  }, [currentSong, currentViewRef, onQueueExhaustedRef, setLocalSongList, sortedCompleteSongs]);
}
