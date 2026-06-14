'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { MutableRefObject, useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface PlaylistBackState {
  view: string;
  artistName: string | null;
}

export interface HomeViewState {
  currentView: string;
  setCurrentView: (view: string) => void;
  currentPlaylistName: string;
  setCurrentPlaylistName: (name: string) => void;
  currentArtistName: string | null;
  setCurrentArtistName: (name: string | null) => void;
  skipNextNameUpdate: MutableRefObject<boolean>;
  showAddSongsModal: boolean;
  setShowAddSongsModal: (show: boolean) => void;
  isUrlBasedImport: boolean;
  setIsUrlBasedImport: (value: boolean) => void;
  saveButtonClicked: boolean;
  setSaveButtonClicked: (value: boolean) => void;
  spotifyImportUrl: string | null;
  setSpotifyImportUrl: (value: string | null) => void;
  discoverResetKey: number;
  setDiscoverResetKey: React.Dispatch<React.SetStateAction<number>>;
  showAddToPlaylistModal: boolean;
  setShowAddToPlaylistModal: (show: boolean) => void;
  preArtistView: string | null;
  setPreArtistView: (view: string | null) => void;
  prePlaylistRoute: PlaylistBackState | null;
  setPrePlaylistRoute: (route: PlaylistBackState | null) => void;
  librarySortBy: 'recent' | 'alpha';
  setLibrarySortBy: React.Dispatch<React.SetStateAction<'recent' | 'alpha'>>;
  librarySortDir: 'asc' | 'desc';
  setLibrarySortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  isSharedPlaylist: boolean;
  sharedPlaylistUserId: string | null;
  sharedPlaylistId: string | null;
  targetSongId: string | null;
  clearTargetSongId: () => void;
  replaceUrl: (url: string) => void;
  setUrlForPersonalPlaylist: (playlistId: string) => void;
  hasActiveRouteParams: boolean;
}

export function useHomeViewState(): HomeViewState {
  const [currentView, setCurrentView] = useState<string>('user-songs');
  const [currentPlaylistName, setCurrentPlaylistName] = useState<string>('');
  const [currentArtistName, setCurrentArtistName] = useState<string | null>(null);
  const skipNextNameUpdate = useRef(false);
  const [showAddSongsModal, setShowAddSongsModal] = useState(false);
  const [isUrlBasedImport, setIsUrlBasedImport] = useState(false);
  const [saveButtonClicked, setSaveButtonClicked] = useState(false);
  const [spotifyImportUrl, setSpotifyImportUrl] = useState<string | null>(null);
  const [discoverResetKey, setDiscoverResetKey] = useState(0);
  const [showAddToPlaylistModal, setShowAddToPlaylistModal] = useState(false);
  const [preArtistView, setPreArtistView] = useState<string | null>(null);
  const [prePlaylistRoute, setPrePlaylistRoute] = useState<PlaylistBackState | null>(null);
  const [librarySortBy, setLibrarySortBy] = useState<'recent' | 'alpha'>('recent');
  const [librarySortDir, setLibrarySortDir] = useState<'asc' | 'desc'>('asc');

  const searchParams = useSearchParams();
  const router = useRouter();
  const hasHandledArtistParam = useRef(false);
  const hasHandledViewParam = useRef(false);
  const routeTargetSongId = searchParams.get('s');
  const [targetSongId, setTargetSongId] = useState<string | null>(routeTargetSongId);

  const replaceUrl = useCallback((url: string) => {
    window.history.replaceState(null, '', url);
  }, []);

  const clearTargetSongId = useCallback(() => {
    if (!targetSongId && !routeTargetSongId) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.delete('s');
    const nextQuery = nextParams.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ''}${window.location.hash}`;

    setTargetSongId(null);
    replaceUrl(nextUrl);
  }, [replaceUrl, routeTargetSongId, searchParams, targetSongId]);

  const setUrlForPersonalPlaylist = useCallback((playlistId: string) => {
    replaceUrl(`/?playlist_id=${encodeURIComponent(playlistId)}`);
  }, [replaceUrl]);

  useEffect(() => {
    setTargetSongId(routeTargetSongId);
  }, [routeTargetSongId]);

  const hasActiveRouteParams = useMemo(() => {
    return Boolean(
      searchParams.get('playlist') ||
      searchParams.get('playlist_id') ||
      searchParams.get('artist') ||
      searchParams.get('view') ||
      targetSongId
    );
  }, [searchParams, targetSongId]);

  const sharedPlaylistParts = useMemo(() => {
    if (!currentView.startsWith('shared:')) {
      return {
        isSharedPlaylist: false,
        sharedPlaylistUserId: null,
        sharedPlaylistId: null,
      };
    }

    const [, sharedPlaylistUserId = null, sharedPlaylistId = null] = currentView.split(':');
    return {
      isSharedPlaylist: true,
      sharedPlaylistUserId,
      sharedPlaylistId,
    };
  }, [currentView]);

  useEffect(() => {
    const viewParam = searchParams.get('view');
    if (viewParam === 'model' && !hasHandledViewParam.current) {
      hasHandledViewParam.current = true;
      setCurrentView('model');
    }

    const playlistParam = searchParams.get('playlist');
    if (playlistParam) {
      const [publicUserId, publicPlaylistId] = playlistParam.split(':');
      if (publicUserId && publicPlaylistId) {
        setCurrentView(`shared:${publicUserId}:${publicPlaylistId}`);
      }
    } else {
      const personalPlaylistParam = searchParams.get('playlist_id');
      if (personalPlaylistParam) {
        setCurrentView(personalPlaylistParam);
      }
    }

    const artistParam = searchParams.get('artist');
    if (artistParam && !hasHandledArtistParam.current) {
      hasHandledArtistParam.current = true;
      setCurrentArtistName(artistParam);
      setCurrentView('discover');
    }

    const spotifyImportParam = searchParams.get('spotify_import');
    if (spotifyImportParam && !spotifyImportUrl) {
      setSpotifyImportUrl(spotifyImportParam);
      setIsUrlBasedImport(true);
      router.replace('/', { scroll: false });
    }
  }, [router, searchParams, spotifyImportUrl]);

  return {
    currentView,
    setCurrentView,
    currentPlaylistName,
    setCurrentPlaylistName,
    currentArtistName,
    setCurrentArtistName,
    skipNextNameUpdate,
    showAddSongsModal,
    setShowAddSongsModal,
    isUrlBasedImport,
    setIsUrlBasedImport,
    saveButtonClicked,
    setSaveButtonClicked,
    spotifyImportUrl,
    setSpotifyImportUrl,
    discoverResetKey,
    setDiscoverResetKey,
    showAddToPlaylistModal,
    setShowAddToPlaylistModal,
    preArtistView,
    setPreArtistView,
    prePlaylistRoute,
    setPrePlaylistRoute,
    librarySortBy,
    setLibrarySortBy,
    librarySortDir,
    setLibrarySortDir,
    isSharedPlaylist: sharedPlaylistParts.isSharedPlaylist,
    sharedPlaylistUserId: sharedPlaylistParts.sharedPlaylistUserId,
    sharedPlaylistId: sharedPlaylistParts.sharedPlaylistId,
    targetSongId,
    clearTargetSongId,
    replaceUrl,
    setUrlForPersonalPlaylist,
    hasActiveRouteParams,
  };
}
