'use client';

import { Dispatch, SetStateAction, useCallback } from 'react';
import { UserPlaylist } from '../contexts/PlaylistContext';
import { Song } from '../lib/api';

interface UseHomeNavigationOptions {
  currentView: string;
  playbackSourceView: string;
  playbackSourceArtist: string | null;
  preArtistView: string | null;
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
  setIsUrlBasedImport: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
}

export function useHomeNavigation({
  currentView,
  playbackSourceView,
  playbackSourceArtist,
  preArtistView,
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
  setIsUrlBasedImport,
  setSearchQuery,
}: UseHomeNavigationOptions) {
  const handlePlaylistSelect = useCallback((playlistId: string, originalUserId?: string) => {
    const newView = playlistId === 'all-songs' ? 'user-songs' : playlistId;

    if (newView === 'discover') {
      setIsViewLoading(false);
      setCurrentView('discover');
      setCurrentPlaylistName('');
      setCurrentArtistName(null);
      setDiscoverResetKey((previousKey) => previousKey + 1);
      replaceUrl('/');
      return;
    }

    if (newView === 'stats') {
      setIsViewLoading(false);
      setCurrentView('stats');
      setCurrentPlaylistName('');
      replaceUrl('/');
      return;
    }

    if (newView === 'model') {
      setIsViewLoading(false);
      setCurrentView('model');
      replaceUrl('/?view=model');
      return;
    }

    if (newView === currentView) return;

    setIsUrlBasedImport(false);
    setSearchQuery('');

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
    hasActiveRouteParams,
    replaceUrl,
    setCurrentArtistName,
    setIsViewLoading,
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
      handlePlaylistSelect(preArtistView === 'user-songs' ? 'all-songs' : preArtistView);
      setPreArtistView(null);
    }
  }, [handlePlaylistSelect, preArtistView, setPreArtistView]);

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
    handleHomeClick,
    handleNowPlayingClick,
  };
}
