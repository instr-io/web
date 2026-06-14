'use client';

import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react';
import { MainLayout } from './components/layout/MainLayout';
import { Song, ArtistSong, addToOfficialQueue, updateUnofficialQueue, setPlaybackSource, saveSharedPlaylist, saveSongToLibrary, bulkSaveSongs, saveArtist, renamePlaylist, deletePlaylist, bulkDeleteSongs, removeSongFromPlaylist } from './lib/api';
import { useIOSKeyboardFix } from './lib/useIOSKeyboardFix';
import { usePopup } from './lib/usePopup';
import { compareSongsByArtistThenTitle, deduplicateSongsByEffectiveTrack, shuffleArray } from './lib/utils';
import { PlaybackProvider, usePlaybackContext } from './contexts/PlaybackContext';
import { SongProvider, useSongContext } from './contexts/SongContext';
import { PlaylistProvider, usePlaylistContext } from './contexts/PlaylistContext';
import { shareToClipboard } from './lib/share';
import { DiscoverView } from './components/discover/DiscoverView';
import { LibraryView } from './components/library/LibraryView';
import { ListeningStatsView } from './components/stats/ListeningStatsView';
import { ModelView } from './components/model/ModelView';
import { SelectionActionBar } from './components/songs/SelectionActionBar';
import { AddToPlaylistModal as AddToPlaylistSelectionModal } from './components/songs/AddToPlaylistModal';
import { useMultiSelect } from './hooks/useMultiSelect';
import { getPlaybackSourceForView, startPlaybackSelection, toSongFromArtistSong, toSongListFromArtistSongs } from './lib/playbackSelection';
import { HomeViewState, useHomeViewState } from './hooks/useHomeViewState';
import { useImportManager } from './hooks/useImportManager';
import { useHomeLifecycle } from './hooks/useHomeLifecycle';
import { useHomeNavigation } from './hooks/useHomeNavigation';
import { usePlaybackLauncher } from './hooks/usePlaybackLauncher';

function HomeContent() {
  useIOSKeyboardFix();
  const viewState = useHomeViewState();

  // AUTH STATE
  const [userId, setUserId] = useState<string | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Wrap in providers - currentView is passed to SongProvider for processingSongs memo
  return (
    <PlaybackProvider currentPlaylistName={viewState.currentPlaylistName}>
      <SongProvider currentView={viewState.currentView}>
        <PlaylistProvider>
        <HomeContentInner
          viewState={viewState}
          userId={userId} setUserId={setUserId}
          isInitialLoad={isInitialLoad} setIsInitialLoad={setIsInitialLoad}
        />
      </PlaylistProvider>
      </SongProvider>
    </PlaybackProvider>
  );
}

interface HomeContentInnerProps {
  viewState: HomeViewState;
  userId: string | null;
  setUserId: (v: string | null) => void;
  isInitialLoad: boolean;
  setIsInitialLoad: (v: boolean) => void;
}

function HomeContentInner(props: HomeContentInnerProps) {
  const {
    viewState,
    userId, setUserId,
    isInitialLoad, setIsInitialLoad,
  } = props;
  const {
    currentView, setCurrentView,
    currentPlaylistName, setCurrentPlaylistName,
    currentArtistName, setCurrentArtistName,
    skipNextNameUpdate,
    showAddSongsModal, setShowAddSongsModal,
    isUrlBasedImport, setIsUrlBasedImport,
    saveButtonClicked, setSaveButtonClicked,
    spotifyImportUrl,
    discoverResetKey, setDiscoverResetKey,
    showAddToPlaylistModal, setShowAddToPlaylistModal,
    preArtistView, setPreArtistView,
    prePlaylistRoute, setPrePlaylistRoute,
    librarySortBy, setLibrarySortBy,
    librarySortDir, setLibrarySortDir,
    isSharedPlaylist,
    sharedPlaylistUserId,
    sharedPlaylistId,
    replaceUrl,
    setUrlForPersonalPlaylist,
    hasActiveRouteParams,
  } = viewState;

  const playback = usePlaybackContext();
  const songs = useSongContext();
  const {
    userPlaylists,
    clearPlaylists,
    loadPlaylists,
    upsertPlaylist,
  } = usePlaylistContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [playbackSourceView, setPlaybackSourceView] = useState<string>('user-songs');
  const [playbackSourceArtist, setPlaybackSourceArtist] = useState<string | null>(null);
  const loadPlaylist = songs.loadPlaylist;
  const setCurrentViewSongs = songs.setCurrentViewSongs;
  const setSearchQuery = songs.setSearchQuery;
  const userSongs = songs.userSongs;

  // Store the clean view identifier for playback source (strips shared:userId: prefix)
  const setPlaybackSource_ = useCallback((view: string) => {
    setPlaybackSourceView(view.startsWith('shared:') ? view.split(':')[2] : view);
  }, []);
  const { showCopiedPopup, popupMessage, popupDuration, showPopup } = usePopup();

  const refreshPlaylists = useCallback(async () => {
    await loadPlaylists(true);
  }, [loadPlaylists]);

  const sortedCompleteSongs = useMemo(() => {
    if (currentView !== 'user-songs') return songs.completeSongs;
    const list = [...deduplicateSongsByEffectiveTrack(songs.completeSongs)];
    if (librarySortBy === 'recent') {
      list.sort((a, b) => {
        const tsA = a.timestamp ?? 0;
        const tsB = b.timestamp ?? 0;
        return librarySortDir === 'asc' ? tsB - tsA : tsA - tsB;
      });
    } else {
      list.sort((a, b) => {
        const cmp = compareSongsByArtistThenTitle(a, b);
        return librarySortDir === 'asc' ? cmp : -cmp;
      });
    }
    return list;
  }, [songs.completeSongs, currentView, librarySortBy, librarySortDir]);

  const [discoverSongs, setDiscoverSongs] = useState<Song[]>([]);
  const multiSelect = useMultiSelect({ songs: sortedCompleteSongs, currentSongId: playback.currentSong?.song_id, onViewChange: currentView });
  const discoverMultiSelect = useMultiSelect({ songs: discoverSongs, currentSongId: playback.currentSong?.song_id, onViewChange: currentView });
  const currentViewRef = useRef(currentView);
  const currentAuthUserIdRef = useRef<string | null>(userId);

  const {
    spotifyImport,
    inlineImport,
    importProgress,
    handleSpotifyUrl,
    handleSearchBarSubmit,
  } = useImportManager({
    currentView,
    currentSongs: songs.currentViewSongs,
    currentViewRef,
    skipNextNameUpdate,
    setCurrentPlaylistName,
    setCurrentView,
    setIsUrlBasedImport,
    setUrlForPersonalPlaylist,
    clearSearch: () => songs.setSearchQuery(''),
    refreshPlaylists,
    loadPlaylist: songs.loadPlaylist,
    setCurrentViewSongs: songs.setCurrentViewSongs,
    startFastPolling: songs.startFastPolling,
    loadUserSongs: songs.loadUserSongs,
    upsertPlaylist,
  });
  const startSpotifyImport = spotifyImport.startImport;
  const isSpotifyImporting = spotifyImport.isImporting;
  const spotifyImportState = spotifyImport.state;

  useEffect(() => {
    if (spotifyImportUrl && !isSpotifyImporting) {
      void startSpotifyImport(spotifyImportUrl);
    }
  }, [isSpotifyImporting, spotifyImportUrl, startSpotifyImport]);

  useHomeLifecycle({
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
    spotifyImportIsImporting: isSpotifyImporting,
  });

  // --- KEYBOARD SHORTCUTS ---
  const handlePlayPauseRef = useRef<() => void>(() => {});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const input = document.querySelector<HTMLInputElement>('.filter-input .search-field-input');
        if (input) {
          e.preventDefault();
          input.focus();
          input.select();
        }
      }

      // Spacebar → play/pause (only when not typing in an input)
      if (e.key === ' ' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        handlePlayPauseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- SAVE BUTTON STATE ---
  useEffect(() => {
    if (isSharedPlaylist && sharedPlaylistId && sharedPlaylistUserId && userPlaylists.length > 0) {
      const isAlreadySaved = userPlaylists.some(p =>
        p.playlist_id === sharedPlaylistId && p.original_user_id === sharedPlaylistUserId
      );
      if (isAlreadySaved) setSaveButtonClicked(true);
    }
  }, [isSharedPlaylist, setSaveButtonClicked, sharedPlaylistId, sharedPlaylistUserId, userPlaylists]);

  // --- HANDLERS ---
  const {
    handlePlaylistSelect,
    handleArtistClick,
    handleArtistBack,
    handlePlaylistBack,
    handleHomeClick,
    handleNowPlayingClick,
  } = useHomeNavigation({
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
  });

  const { resumeQueuedPlayback, startPlaybackFromCurrentContext } = usePlaybackLauncher({
    currentView,
    currentArtistName,
    discoverSongs,
    sortedCompleteSongs,
    fallbackCompleteSongs: songs.completeSongs,
    playback,
    setPlaybackSourceView: setPlaybackSource_,
    setPlaybackSourceArtist,
  });

  const handleSongSelect = (song: Song) => {
    if (song.status !== 'COMPLETE') return;

    setPlaybackSource_(currentView);
    setPlaybackSourceArtist(null);
    const songList = sortedCompleteSongs;
    const selectedIndex = songList.findIndex((candidate) => candidate.song_id === song.song_id);

    void startPlaybackSelection({
      playback,
      selectedSong: song,
      songList,
      selectedIndex,
      source: getPlaybackSourceForView(currentView),
      isShuffled: playback.isShuffled,
    });
  };

  const handlePlaylistCreated = async (playlistId: string, playlistName: string, initialSongIds: string[] = []) => {
    const selectedSongIds = new Set(initialSongIds);
    const initialSongs = selectedSongIds.size === 0
      ? []
      : songs.currentViewSongs.filter((song) => selectedSongIds.has(song.song_id));

    upsertPlaylist({
      playlist_id: playlistId,
      playlist_name: playlistName,
      song_count: initialSongs.length,
    });
    void refreshPlaylists();
    skipNextNameUpdate.current = true;
    setCurrentPlaylistName(playlistName);
    setCurrentArtistName(null);
    setUrlForPersonalPlaylist(playlistId);
    songs.setCurrentViewSongs(initialSongs);
    setCurrentView(playlistId);
    setIsViewLoading(initialSongs.length === 0);

    songs.startFastPolling();

    if (!playback.currentSong) {
      try {
        const source = `playlist:${playlistId}`;
        await setPlaybackSource(source).catch(err =>
          console.error('Failed to set playback source:', err)
        );
        await updateUnofficialQueue();
      } catch (error) {
        console.error('Failed to set playback source:', error);
      }
    }
  };

  const handleRenamePlaylist = useCallback(async (newName: string) => {
    if (!userId || currentView === 'user-songs' || currentView === 'discover') {
      return;
    }

    try {
      // Get current song IDs from the view
      const songIds = songs.currentViewSongs.map(song => song.song_id);

      await renamePlaylist(currentView, newName, songIds);
      setCurrentPlaylistName(newName);
      await refreshPlaylists();
    } catch (err) {
      console.error('Failed to rename playlist:', err);
      throw err; // Let EditableTitle handle the error
    }
  }, [currentView, refreshPlaylists, setCurrentPlaylistName, songs.currentViewSongs, userId]);

  const handleEditingChange = useCallback((isEditing: boolean) => {
    setIsEditingTitle(isEditing);
  }, []);

  const handlePlayPause = async () => {
    if (playback.audioRef.current) {
      if (playback.isPlaying) {
        playback.audioRef.current.pause();
        playback.setIsPlaying(false);
      } else if (playback.currentSong) {
        playback.audioRef.current.play().catch(console.error);
        playback.setIsPlaying(true);
      } else {
        // When on discover/artist view with songs, play those directly
        // instead of resuming a stale queue from a different context
        const hasDiscoverSongs = currentView === 'discover' && discoverSongs.length > 0;

        if (!hasDiscoverSongs) {
          const resumedQueuedPlayback = await resumeQueuedPlayback();
          if (resumedQueuedPlayback) {
            return;
          }
        }

        await startPlaybackFromCurrentContext();
      }
    }
  };
  handlePlayPauseRef.current = handlePlayPause;

  const handleShareCurrentPlaylist = async () => {
    if (!sharedPlaylistId) return;

    let shareUrl: string;
    try {
      const { sharePlaylist } = await import('./lib/api');
      const result = await sharePlaylist(sharedPlaylistId);
      shareUrl = `${window.location.origin}${result.share_url}`;
    } catch (err) {
      shareUrl = `${window.location.origin}?playlist=${sharedPlaylistUserId}:${sharedPlaylistId}`;
    }

    await shareToClipboard(shareUrl, showPopup);
  };

  const handleShareRegularPlaylist = async (playlistId: string) => {
    // Artist playlists share as ?artist=Name, not as playlist shortlinks
    if (currentArtistName) {
      const shareUrl = `${window.location.origin}?artist=${encodeURIComponent(currentArtistName)}`;
      await shareToClipboard(shareUrl, showPopup);
      return;
    }

    let shareUrl: string;
    try {
      const { sharePlaylist } = await import('./lib/api');
      const result = await sharePlaylist(playlistId);
      shareUrl = `${window.location.origin}${result.share_url}`;
    } catch (err) {
      shareUrl = `${window.location.origin}?playlist=${userId}:${playlistId}`;
    }

    await shareToClipboard(shareUrl, showPopup);
  };

  const handleSaveCurrentPlaylist = async () => {
    if (!sharedPlaylistId || !sharedPlaylistUserId) return;
    setSaveButtonClicked(true);

    try {
      showPopup("Playlist saved!", 1000);
      await saveSharedPlaylist(sharedPlaylistUserId, sharedPlaylistId);
      await refreshPlaylists();
    } catch (err) {
      console.error('Failed to save playlist:', err);
      setSaveButtonClicked(false);
    }
  };

  const handleDiscoverSongSelect = async (song: ArtistSong, allSongs: ArtistSong[], artistName: string | null) => {
    setPlaybackSourceView('discover');
    setPlaybackSourceArtist(artistName);
    const localSongs = toSongListFromArtistSongs(allSongs, artistName);
    const selectedIndex = localSongs.findIndex((candidate) => candidate.song_id === song.song_id);
    const selectedSong = localSongs[selectedIndex] ?? toSongFromArtistSong(song, artistName);

    const didStartPlayback = await startPlaybackSelection({
      playback,
      selectedSong,
      songList: localSongs,
      selectedIndex,
      source: 'discover',
      isShuffled: playback.isShuffled,
    });

    if (!didStartPlayback) {
      return;
    }
  };

  const handleDiscoverAddToQueue = async (song: { song_id: string }) => {
    try {
      showPopup('Queued!', 1000);
      await addToOfficialQueue([song.song_id]);
      await playback.loadQueue();
    } catch (err) {
      console.error('Failed to add to queue:', err);
    }
  };

  const handleDiscoverSaveToLibrary = async (song: { song_id: string }) => {
    try {
      await saveSongToLibrary(song.song_id);
      showPopup('SAVED!', 1000);
      await songs.loadUserSongs();
    } catch (err) {
      console.error('Failed to save song to library:', err);
    }
  };

  const handleQueueAll = useCallback(async (songIds: string[]) => {
    if (songIds.length === 0) return;
    const ids = playback.isShuffled
      ? shuffleArray([...songIds])
      : songIds;
    try {
      await addToOfficialQueue(ids);
      await playback.loadQueue();
      showPopup(`${ids.length} queued!`, 1000);
    } catch (err) {
      console.error('Failed to queue all:', err);
    }
  }, [playback, showPopup]);

  const handleDiscoverSaveAsPlaylist = async (artistName: string, artistSongs: ArtistSong[]) => {
    try {
      showPopup('Artist saved!', 1000);
      await saveArtist(artistName);
      await refreshPlaylists();
    } catch (err) {
      console.error('Failed to save artist:', err);
    }
  };

  const handleDiscoverUnsaveArtist = async (artistName: string) => {
    const savedPlaylist = userPlaylists.find(p => p.artist_name === artistName);
    if (!savedPlaylist) return;
    try {
      await deletePlaylist(savedPlaylist.playlist_id);
      showPopup('Artist removed', 1000);
      await refreshPlaylists();
    } catch (err) {
      console.error('Failed to unsave artist:', err);
    }
  };

  const isCurrentPlaylistFromAnotherUser = () => {
    if (!userId || currentView === 'user-songs' || isSharedPlaylist) return false;
    const currentPlaylist = userPlaylists.find(p => p.playlist_id === currentView);
    return currentPlaylist && currentPlaylist.original_user_id && currentPlaylist.original_user_id !== userId;
  };

  const shouldCompactMobilePlayerSpacing =
    currentView !== 'user-songs' &&
    currentView !== 'discover' &&
    currentView !== 'stats' &&
    currentView !== 'model' &&
    !isSharedPlaylist &&
    !isCurrentPlaylistFromAnotherUser();

  const queueContextLabel = useMemo(() => {
    if (playbackSourceView === 'discover') {
      return playbackSourceArtist || currentArtistName || 'All Artists';
    }

    if (playbackSourceView === 'user-songs') {
      return 'Your Library';
    }

    if (playbackSourceView === currentView && currentPlaylistName) {
      return currentPlaylistName;
    }

    const matchedPlaylist = userPlaylists.find((playlist) => playlist.playlist_id === playbackSourceView);
    if (matchedPlaylist?.artist_name) {
      return matchedPlaylist.artist_name;
    }

    return matchedPlaylist?.playlist_name || currentPlaylistName || 'Current Source';
  }, [
    currentArtistName,
    currentPlaylistName,
    currentView,
    playbackSourceArtist,
    playbackSourceView,
    userPlaylists,
  ]);

  // --- IMPORT LOADING SCREEN ---
  const showImportLoadingScreen = isUrlBasedImport && currentView === 'user-songs' && spotifyImportState.status !== 'error';
  if (showImportLoadingScreen) {
    return (
      <div className="outer-container">
        <header className="site-header">
          <h1>instr.io</h1>
        </header>
        <div className="spotify-import-loading">
          <div className="spotify-import-status-text">{importProgress || 'Starting import...'}</div>
        </div>
      </div>
    );
  }

  // --- RENDER ---
  return (
    <>
      <MainLayout
        currentSong={playback.currentSong}
        isPlaying={playback.isPlaying}
        currentTime={playback.currentTime}
        duration={playback.duration}
        onSeek={playback.handleSeek}
        onPlayPause={handlePlayPause}
        onNext={playback.playNext}
        onPrevious={playback.playPrevious}
        onPlaylistSelect={handlePlaylistSelect}
        onPlaylistCreated={handlePlaylistCreated}
        onPlaylistDeleted={() => {
          void refreshPlaylists();
        }}
        audioRef={playback.audioRef}
        isSharedPlaylist={isSharedPlaylist}
        onLoadQueue={playback.loadQueue}
        isShuffled={playback.isShuffled}
        setIsShuffled={playback.setIsShuffled}
        repeatAll={playback.repeatAll}
        setRepeatAll={playback.setRepeatAll}
        repeatOne={playback.repeatOne}
        setRepeatOne={playback.setRepeatOne}
        rebuildUnofficialQueue={playback.rebuildUnofficialQueue}
        onNowPlayingClick={handleNowPlayingClick}
        onArtistClick={handleArtistClick}
        onHomeClick={handleHomeClick}
        sidebarSearchQuery={songs.searchQuery}
        compactMobilePlayerSpacing={shouldCompactMobilePlayerSpacing}
        queueContextLabel={queueContextLabel}
      >
        {currentView === 'stats' ? (
          <ListeningStatsView />
        ) : currentView === 'model' ? (
          <ModelView />
        ) : currentView === 'discover' ? (
          /* Discover view - artist browsing */
          <>
          <DiscoverView
            key={`${currentArtistName || 'discover'}-${discoverResetKey}`}
            onSongSelect={handleDiscoverSongSelect}
            onAddToQueue={(e, song) => { e.stopPropagation(); void handleDiscoverAddToQueue(song); }}
            onSaveToLibrary={(e, song) => { e.stopPropagation(); void handleDiscoverSaveToLibrary(song); }}
            onSaveAsPlaylist={handleDiscoverSaveAsPlaylist}
            onUnsaveArtist={handleDiscoverUnsaveArtist}
            savedArtists={userPlaylists
              .map((playlist) => playlist.artist_name)
              .filter((artistName): artistName is string => Boolean(artistName))}
            initialArtist={currentArtistName}
            onBack={preArtistView ? handleArtistBack : undefined}
            currentSongId={playback.currentSong?.song_id}
            isSelected={discoverMultiSelect.isSelected}
            onSelectionClick={discoverMultiSelect.handleClick}
            onDragStart={discoverMultiSelect.handleDragStart}
            onDragMove={discoverMultiSelect.handleDragMove}
            onDragEnd={discoverMultiSelect.handleDragEnd}
            hasSelection={discoverMultiSelect.selectedCount > 0}
            onRightClickSelect={discoverMultiSelect.selectSingle}
            onArtistSongsChanged={setDiscoverSongs}
            onQueueAll={handleQueueAll}
            showPopup={showPopup}
            mobileSelectionMode={discoverMultiSelect.mobileSelectionMode}
            onEnterMobileSelectionMode={discoverMultiSelect.enterMobileSelectionMode}
            onExitMobileSelectionMode={discoverMultiSelect.exitMobileSelectionMode}
          />
          <SelectionActionBar
            selectedCount={discoverMultiSelect.selectedCount}
            selectedSong={discoverMultiSelect.selectedCount === 1 ? discoverSongs.find(s => s.song_id === discoverMultiSelect.selectedSongIds()[0]) : undefined}
            mobileSelectionMode={discoverMultiSelect.mobileSelectionMode}
            onAddToPlaylist={() => setShowAddToPlaylistModal(true)}
            onAddToQueue={async () => {
              const ids = discoverMultiSelect.selectedSongIds();
              if (ids.length === 0) return;
              const count = ids.length;
              discoverMultiSelect.clearSelection();
              discoverMultiSelect.exitMobileSelectionMode();
              try {
                await addToOfficialQueue(ids);
                await playback.loadQueue();
              } catch (err) {
                console.error('Failed to add to queue:', err);
              }
              setTimeout(() => showPopup(`${count} queued!`, 1000), 150);
            }}
            onSave={async () => {
              const ids = discoverMultiSelect.selectedSongIds();
              if (ids.length === 0) return;
              try {
                await bulkSaveSongs(ids);
                showPopup('SAVED!', 1000);
                await songs.loadUserSongs();
              } catch (err) {
                console.error('Failed to save songs:', err);
              }
              discoverMultiSelect.clearSelection();
              discoverMultiSelect.exitMobileSelectionMode();
            }}
            onClear={discoverMultiSelect.clearSelection}
            onExitMobileSelectionMode={discoverMultiSelect.exitMobileSelectionMode}
          />
          <AddToPlaylistSelectionModal
            isOpen={showAddToPlaylistModal && currentView === 'discover'}
            onClose={() => setShowAddToPlaylistModal(false)}
            songIds={discoverMultiSelect.selectedSongIds()}
            onComplete={() => {
              discoverMultiSelect.clearSelection();
              discoverMultiSelect.exitMobileSelectionMode();
              void refreshPlaylists();
            }}
            onNavigateToPlaylist={handlePlaylistCreated}
          />
          </>
        ) : (
          <LibraryView
            currentView={currentView}
            currentPlaylistName={currentPlaylistName}
            currentArtistName={currentArtistName}
            userId={userId}
            isSharedPlaylist={isSharedPlaylist}
            sharedPlaylistUserId={sharedPlaylistUserId}
            isEditingTitle={isEditingTitle}
            saveButtonClicked={saveButtonClicked}
            showAddSongsModal={showAddSongsModal}
            setShowAddSongsModal={setShowAddSongsModal}
            showAddToPlaylistModal={showAddToPlaylistModal && currentView !== 'discover'}
            setShowAddToPlaylistModal={setShowAddToPlaylistModal}
            librarySortBy={librarySortBy}
            setLibrarySortBy={setLibrarySortBy}
            librarySortDir={librarySortDir}
            setLibrarySortDir={setLibrarySortDir}
            importProgress={importProgress}
            inlineImportStatus={inlineImport.status}
            searchQuery={songs.searchQuery}
            setSearchQuery={songs.setSearchQuery}
            sortedCompleteSongs={sortedCompleteSongs}
            currentViewSongs={songs.currentViewSongs}
            processingSongs={songs.processingSongs}
            currentSongId={playback.currentSong?.song_id}
            isInitialLoad={isInitialLoad}
            isLoading={songs.isLoading || isSpotifyImporting}
            isViewLoading={isViewLoading}
            isImporting={isSpotifyImporting}
            isCurrentPlaylistFromAnotherUser={Boolean(isCurrentPlaylistFromAnotherUser())}
            selectedSong={multiSelect.selectedCount === 1 ? songs.currentViewSongs.find((song) => song.song_id === multiSelect.selectedSongIds()[0]) : undefined}
            multiSelect={multiSelect}
            onBack={prePlaylistRoute ? handlePlaylistBack : undefined}
            onRenamePlaylist={handleRenamePlaylist}
            onEditingChange={handleEditingChange}
            onShareCurrentPlaylist={handleShareCurrentPlaylist}
            onShareRegularPlaylist={handleShareRegularPlaylist}
            onSaveCurrentPlaylist={handleSaveCurrentPlaylist}
            onQueueAll={handleQueueAll}
            onSongSelect={handleSongSelect}
            onSongAddToQueue={(e, song) => { showPopup('Queued!', 1000); void songs.handleAddToQueue(e, song, playback.loadQueue); }}
            onSongDelete={songs.handleDeleteSong}
            onSongRetry={songs.handleRetrySong}
            onArtistClick={handleArtistClick}
            onSearchBarSubmit={handleSearchBarSubmit}
            onSpotifyUrl={handleSpotifyUrl}
            onSongsAdded={async () => {
              if (currentView === 'user-songs') {
                await songs.loadUserSongs();
              } else {
                await refreshPlaylists();
                try {
                  const playlistData = await songs.loadPlaylist(currentView);
                  songs.setCurrentViewSongs(playlistData.songs);
                } catch (error) {
                  console.error('Failed to reload playlist after adding songs:', error);
                }
              }
              songs.startFastPolling();
            }}
            onAddToPlaylistComplete={() => {
              multiSelect.clearSelection();
              multiSelect.exitMobileSelectionMode();
              void refreshPlaylists();
            }}
            onNavigateToPlaylist={handlePlaylistCreated}
            onMultiSelectQueue={async () => {
              const ids = multiSelect.selectedSongIds();
              if (ids.length === 0) return;
              const count = ids.length;
              multiSelect.clearSelection();
              multiSelect.exitMobileSelectionMode();
              try {
                await addToOfficialQueue(ids);
                await playback.loadQueue();
              } catch (err) {
                console.error('Failed to add to queue:', err);
              }
              setTimeout(() => showPopup(`${count} queued!`, 1000), 150);
            }}
            onMultiSelectSave={currentView !== 'user-songs' ? async () => {
              const ids = multiSelect.selectedSongIds();
              if (ids.length === 0) return;
              try {
                await bulkSaveSongs(ids);
                showPopup('SAVED!', 1000);
                await songs.loadUserSongs();
              } catch (err) {
                console.error('Failed to save songs:', err);
              }
              multiSelect.clearSelection();
              multiSelect.exitMobileSelectionMode();
            } : undefined}
            onMultiSelectDelete={
              !isCurrentPlaylistFromAnotherUser() && (!isSharedPlaylist || sharedPlaylistUserId === userId)
                ? async () => {
                    const ids = multiSelect.selectedSongIds();
                    if (ids.length === 0) return;

                    songs.lastMutationTime.current = Date.now();
                    songs.addPendingDeletions(ids);
                    const idsSet = new Set(ids);
                    if (currentView === 'user-songs') {
                      const updated = songs.userSongs.filter((song) => !idsSet.has(song.song_id));
                      songs.setUserSongs(updated);
                      songs.setCurrentViewSongs(updated);
                    } else {
                      const updated = songs.currentViewSongs.filter((song) => !idsSet.has(song.song_id));
                      songs.setCurrentViewSongs(updated);
                    }
                    multiSelect.clearSelection();

                    try {
                      if (currentView === 'user-songs') {
                        await bulkDeleteSongs(ids);
                      } else {
                        await Promise.all(ids.map((id) => removeSongFromPlaylist(currentView, id)));
                      }
                      songs.lastMutationTime.current = Date.now();
                      songs.startFastPolling(5);
                    } catch (err) {
                      console.error('Failed to delete songs:', err);
                      await songs.loadUserSongs();
                    }
                    multiSelect.exitMobileSelectionMode();
                  }
                : undefined
            }
            onSongReplaced={currentView === 'user-songs' ? () => { void songs.loadUserSongs(); } : undefined}
          />
        )}

        {showCopiedPopup && (
          <div className="copied-popup" style={{ '--popup-duration': `${popupDuration}ms` } as React.CSSProperties}>
            {popupMessage}
          </div>
        )}
      </MainLayout>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div />}>
      <HomeContent />
    </Suspense>
  );
}
