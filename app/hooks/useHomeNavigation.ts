'use client';

import { Dispatch, SetStateAction, useCallback } from 'react';
import { UserPlaylist } from '../contexts/PlaylistContext';
import { Song } from '../lib/api';
import type { PlaylistBackState } from './useHomeViewState';

interface UseHomeNavigationOptions {
  currentView: string;
  currentArtistName: string | null;
  playbackSourceView: string;
  playbackSourceArtist: string | null;
  preArtistView: string | null;
  prePlaylistRoute: PlaylistBackState | null;
  userPlaylists: UserPlaylist[];
  userSongs: Song[];
  hasActiveRouteParams: boolean;
  replaceUrl: (url: string) => void;
  setUrlForPersonalPlaylist: (playlistId: string) => void;
  setCurrentViewSongs: (songs: Song[]) => void;
  setIsViewLoading: (value: boolean) => void;
  setCurrentView: (view: string) => void;
  setCurrentPlaylistName: (name: string) => void;
  setCurrentArtistName: (name: string | null) => void;
  setDiscoverResetKey: Dispatch<SetStateAction<number>>;
  setPreArtistView: (view: string | null) => void;
  setPrePlaylistRoute: (route: PlaylistBackState | null) => void;
  setIsUrlBasedImport: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export function useHomeNavigation({
  currentView,
  currentArtistName,
  playbackSourceView,
  playbackSourceArtist,
  preArtistView,
  prePlaylistRoute,
  userPlaylists,
  userSongs,
  hasActiveRouteParams,
  replaceUrl,
  setUrlForPersonalPlaylist,
  setCurrentViewSongs,
  setIsViewLoading,
  setCurrentView,
  setCurrentPlaylistName,
  setCurrentArtistName,
  setDiscoverResetKey,
  setPreArtistView,
  setPrePlaylistRoute,
  setIsUrlBasedImport,
  setSearchQuery,
}: UseHomeNavigationOptions) {
  const handlePlaylistSelect = useCallback((playlistId: string, originalUserId?: string, options?: { trackPrevious?: boolean }) => {
    const newView = playlistId === 'all-songs' ? 'user-songs' : playlistId;
    const trackPrevious = options?.trackPrevious ?? true;

    if (newView === 'discover') {
      setIsViewLoading(false);
      setCurrentView('discover');
      setCurrentPlaylistName('');
      setCurrentArtistName(null);
      setPrePlaylistRoute(null);
      setDiscoverResetKey((previousKey) => previousKey + 1);
      replaceUrl('/');
      return;
    }

    if (newView === 'stats') {
      setIsViewLoading(false);
      setCurrentView('stats');
      setCurrentPlaylistName('');
      setPrePlaylistRoute(null);
      replaceUrl('/');
      return;
    }

    if (newView === 'model') {
      setIsViewLoading(false);
      setCurrentView('model');
      setPrePlaylistRoute(null);
      replaceUrl('/?view=model');
      return;
    }

    if (newView === currentView) return;

    setIsUrlBasedImport(false);
    setSearchQuery('');

    if (trackPrevious && newView !== 'user-songs') {
      setPrePlaylistRoute({
        view: currentView,
        artistName: currentArtistName,
      });
    }

    if (hasActiveRouteParams) {
      replaceUrl('/');
    }

    if (newView !== 'user-songs') {
      const knownPlaylist = userPlaylists.find((playlist) => playlist.playlist_id === newView);
      if (knownPlaylist) {
        const publicUserId = originalUserId || knownPlaylist.original_user_id;

        if (knownPlaylist.artist_name) {
          setIsViewLoading(false);
          setCurrentArtistName(knownPlaylist.artist_name);
          setCurrentView('discover');
          setCurrentPlaylistName('');
          replaceUrl(`?artist=${encodeURIComponent(knownPlaylist.artist_name)}`);
          return;
        }

        setIsViewLoading(true);
        setCurrentArtistName(null);
        setCurrentPlaylistName(knownPlaylist.playlist_name);
        setUrlForPersonalPlaylist(newView);
        setCurrentView(newView);
        return;
      }
    } else {
      setIsViewLoading(false);
      setCurrentPlaylistName('');
      setCurrentArtistName(null);
      setPrePlaylistRoute(null);
      setCurrentViewSongs(userSongs);
      replaceUrl('/');
    }

    if (newView !== 'user-songs') {
      setIsViewLoading(true);
      setCurrentArtistName(null);
      setUrlForPersonalPlaylist(newView);
    }

    setCurrentView(newView);
  }, [
    currentView,
    currentArtistName,
    hasActiveRouteParams,
    replaceUrl,
    setCurrentArtistName,
    setIsViewLoading,
    setPrePlaylistRoute,
    setCurrentPlaylistName,
    setCurrentView,
    setCurrentViewSongs,
    setDiscoverResetKey,
    setIsUrlBasedImport,
    setSearchQuery,
    setUrlForPersonalPlaylist,
    userPlaylists,
    userSongs,
  ]);

  const handleArtistClick = useCallback((artistName: string) => {
    if (currentView !== 'discover') {
      setPreArtistView(currentView);
    }
    setCurrentArtistName(artistName);
    setCurrentView('discover');
    setCurrentPlaylistName('');
    replaceUrl(`?artist=${encodeURIComponent(artistName)}`);
    setDiscoverResetKey((previousKey) => previousKey + 1);
  }, [currentView, replaceUrl, setCurrentArtistName, setCurrentPlaylistName, setCurrentView, setDiscoverResetKey, setPreArtistView]);

  const handleArtistBack = useCallback(() => {
    if (preArtistView) {
      handlePlaylistSelect(preArtistView === 'user-songs' ? 'all-songs' : preArtistView, undefined, { trackPrevious: false });
      setPreArtistView(null);
    }
  }, [handlePlaylistSelect, preArtistView, setPreArtistView]);

  const handlePlaylistBack = useCallback(() => {
    if (!prePlaylistRoute) return;

    const { view, artistName } = prePlaylistRoute;
    setPrePlaylistRoute(null);

    if (view === 'discover') {
      setIsViewLoading(false);
      setCurrentView('discover');
      setCurrentPlaylistName('');
      setCurrentArtistName(artistName);
      replaceUrl(artistName ? `?artist=${encodeURIComponent(artistName)}` : '/');
      if (artistName) {
        setDiscoverResetKey((previousKey) => previousKey + 1);
      }
      return;
    }

    if (view === 'stats') {
      setIsViewLoading(false);
      setCurrentView('stats');
      setCurrentPlaylistName('');
      setCurrentArtistName(null);
      replaceUrl('/');
      return;
    }

    if (view === 'model') {
      setIsViewLoading(false);
      setCurrentView('model');
      setCurrentPlaylistName('');
      setCurrentArtistName(null);
      replaceUrl('/?view=model');
      return;
    }

    handlePlaylistSelect(view === 'user-songs' ? 'all-songs' : view, undefined, { trackPrevious: false });
  }, [
    handlePlaylistSelect,
    prePlaylistRoute,
    replaceUrl,
    setCurrentArtistName,
    setCurrentPlaylistName,
    setCurrentView,
    setDiscoverResetKey,
    setIsViewLoading,
    setPrePlaylistRoute,
  ]);

  const handleHomeClick = useCallback(() => {
    handlePlaylistSelect('all-songs');
  }, [handlePlaylistSelect]);

  const handleNowPlayingClick = useCallback(() => {
    if (playbackSourceView === 'discover' && playbackSourceArtist) {
      setCurrentView('discover');
      setCurrentPlaylistName('');
      setCurrentArtistName(playbackSourceArtist);
      replaceUrl(`?artist=${encodeURIComponent(playbackSourceArtist)}`);
      setDiscoverResetKey((previousKey) => previousKey + 1);
      return;
    }

    if (playbackSourceView === currentView) return;

    handlePlaylistSelect(playbackSourceView === 'user-songs' ? 'all-songs' : playbackSourceView);
  }, [
    currentView,
    handlePlaylistSelect,
    playbackSourceArtist,
    playbackSourceView,
    replaceUrl,
    setCurrentArtistName,
    setCurrentPlaylistName,
    setCurrentView,
    setDiscoverResetKey,
  ]);

  return {
    handlePlaylistSelect,
    handleArtistClick,
    handleArtistBack,
    handlePlaylistBack,
    handleHomeClick,
    handleNowPlayingClick,
  };
}
