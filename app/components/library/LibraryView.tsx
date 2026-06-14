'use client';

import { Song } from '@/app/lib/api';
import { ImportStatus } from '@/app/lib/useImport';
import { AddSongsModal } from '@/app/components/playlist/AddSongsModal';
import { ConvertingSection } from '@/app/components/queue/ConvertingSection';
import { ShareButton } from '@/app/components/playlist/ShareButton';
import { SaveButton } from '@/app/components/playlist/SaveButton';
import { VirtualizedSongList } from '@/app/components/songs/VirtualizedSongList';
import { EditableTitle } from '@/app/components/common/EditableTitle';
import { SelectionActionBar } from '@/app/components/songs/SelectionActionBar';
import { AddToPlaylistModal } from '@/app/components/songs/AddToPlaylistModal';
import { SearchField } from '@/app/components/common/SearchField';
import { LoadingDots } from '@/app/components/common/LoadingDots';

function MoreToggleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

interface LibrarySelectionController {
  selectedCount: number;
  selectedSongIds: () => string[];
  clearSelection: () => void;
  isSelected: (songId: string) => boolean;
  handleClick: (index: number, song: Song, event: React.MouseEvent) => boolean;
  handleDragStart: (index: number) => void;
  handleDragMove: (index: number) => void;
  handleDragEnd: () => boolean;
  selectSingle: (songId: string) => void;
  mobileSelectionMode: boolean;
  enterMobileSelectionMode: (songId?: string) => void;
  exitMobileSelectionMode: () => void;
}

interface LibraryViewProps {
  currentView: string;
  currentPlaylistName: string;
  currentArtistName: string | null;
  userId: string | null;
  isSharedPlaylist: boolean;
  sharedPlaylistUserId: string | null;
  isEditingTitle: boolean;
  saveButtonClicked: boolean;
  showAddSongsModal: boolean;
  setShowAddSongsModal: (show: boolean) => void;
  showAddToPlaylistModal: boolean;
  setShowAddToPlaylistModal: (show: boolean) => void;
  librarySortBy: 'recent' | 'alpha';
  setLibrarySortBy: React.Dispatch<React.SetStateAction<'recent' | 'alpha'>>;
  librarySortDir: 'asc' | 'desc';
  setLibrarySortDir: React.Dispatch<React.SetStateAction<'asc' | 'desc'>>;
  importProgress: string;
  inlineImportStatus: ImportStatus;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortedCompleteSongs: Song[];
  currentViewSongs: Song[];
  processingSongs: Song[];
  currentSongId?: string;
  focusedSongId?: string;
  isInitialLoad: boolean;
  isLoading: boolean;
  isViewLoading: boolean;
  isImporting: boolean;
  isCurrentPlaylistFromAnotherUser: boolean;
  selectedSong?: Song;
  multiSelect: LibrarySelectionController;
  onBack?: () => void;
  onRenamePlaylist: (newName: string) => Promise<void>;
  onEditingChange: (editing: boolean) => void;
  onShareCurrentPlaylist: () => Promise<void>;
  onShareRegularPlaylist: (playlistId: string) => Promise<void>;
  onSaveCurrentPlaylist: () => Promise<void>;
  onQueueAll: (songIds: string[]) => Promise<void>;
  onSongSelect: (song: Song) => void;
  onSongAddToQueue: (e: React.MouseEvent, song: Song) => void;
  onShareSong?: (song: Song, options?: { forceClipboard?: boolean }) => Promise<void> | void;
  onSongDelete: (e: React.MouseEvent, song: Song) => Promise<void>;
  onSongRetry: (e: React.MouseEvent, song: Song) => Promise<void>;
  onArtistClick: (artistName: string) => void;
  onSearchBarSubmit: (value: string) => Promise<void>;
  onSpotifyUrl: (url: string) => void;
  onSongsAdded: () => Promise<void>;
  onAddToPlaylistComplete: () => void;
  onNavigateToPlaylist: (playlistId: string, playlistName: string, songIds?: string[]) => void;
  onMultiSelectQueue: () => Promise<void>;
  onMultiSelectSave?: () => Promise<void>;
  onMultiSelectDelete?: () => Promise<void>;
  onSongReplaced?: () => Promise<void> | void;
}

export function LibraryView({
  currentView,
  currentPlaylistName,
  currentArtistName,
  userId,
  isSharedPlaylist,
  sharedPlaylistUserId,
  isEditingTitle,
  saveButtonClicked,
  showAddSongsModal,
  setShowAddSongsModal,
  showAddToPlaylistModal,
  setShowAddToPlaylistModal,
  librarySortBy,
  setLibrarySortBy,
  librarySortDir,
  setLibrarySortDir,
  importProgress,
  inlineImportStatus,
  searchQuery,
  setSearchQuery,
  sortedCompleteSongs,
  currentViewSongs,
  processingSongs,
  currentSongId,
  focusedSongId,
  isInitialLoad,
  isLoading,
  isViewLoading,
  isImporting,
  isCurrentPlaylistFromAnotherUser,
  selectedSong,
  multiSelect,
  onBack,
  onRenamePlaylist,
  onEditingChange,
  onShareCurrentPlaylist,
  onShareRegularPlaylist,
  onSaveCurrentPlaylist,
  onQueueAll,
  onSongSelect,
  onSongAddToQueue,
  onShareSong,
  onSongDelete,
  onSongRetry,
  onArtistClick,
  onSearchBarSubmit,
  onSpotifyUrl,
  onSongsAdded,
  onAddToPlaylistComplete,
  onNavigateToPlaylist,
  onMultiSelectQueue,
  onMultiSelectSave,
  onMultiSelectDelete,
  onSongReplaced,
}: LibraryViewProps) {
  const displayPlaylistTitle = currentPlaylistName || 'LOADING';
  const shouldShowPlaylistTitle = currentView !== 'user-songs' && (Boolean(currentPlaylistName) || isViewLoading);
  const showTitleActions = !isEditingTitle && Boolean(userId) && currentView !== 'user-songs' && Boolean(currentPlaylistName);
  const showTitleLoading = currentView !== 'user-songs' && isViewLoading;
  const isPlaylistView = currentView !== 'user-songs';
  const showPlaylistBack = currentView !== 'user-songs' && Boolean(onBack);

  return (
    <>
      {showPlaylistBack && (
        <div
          className="song-row discover-back-row playlist-back-row"
          onClick={onBack}
        >
          <span className="song-title ui-compact-action--label">
            &larr; BACK
          </span>
        </div>
      )}

      {shouldShowPlaylistTitle ? (
        <div className="ui-title-row">
          {userId && currentView !== 'user-songs' && !isSharedPlaylist && Boolean(currentPlaylistName) ? (
            <EditableTitle
              title={displayPlaylistTitle}
              onSave={onRenamePlaylist}
              onEditingChange={onEditingChange}
            />
          ) : (
            <h2 className="page-title">{displayPlaylistTitle}</h2>
          )}

          {showTitleActions && (
            <>
              {isSharedPlaylist ? (
                sharedPlaylistUserId === userId ? (
                  <ShareButton
                    onShare={onShareCurrentPlaylist}
                    title="Share playlist"
                    size="small"
                  />
                ) : (
                  !saveButtonClicked && (
                    <SaveButton
                      onSave={onSaveCurrentPlaylist}
                      title="Save playlist to your library"
                    />
                  )
                )
              ) : (
                <ShareButton
                  onShare={() => onShareRegularPlaylist(currentView)}
                  title="Share playlist"
                  size="small"
                />
              )}
              {sortedCompleteSongs.length > 0 && (
                <button
                  className="ui-compact-action ui-compact-action--queue"
                  onClick={() => void onQueueAll(sortedCompleteSongs.map((song) => song.song_id))}
                  title="Queue all songs"
                >
                  &rarr;
                </button>
              )}
              {!showTitleLoading && (
                <button
                  className="ui-compact-action ui-compact-action--more mobile-selection-toggle"
                  onClick={() => {
                    if (multiSelect.mobileSelectionMode) multiSelect.exitMobileSelectionMode();
                    else multiSelect.enterMobileSelectionMode();
                  }}
                  aria-label={multiSelect.mobileSelectionMode ? 'Exit selection mode' : 'Select songs'}
                  title={multiSelect.mobileSelectionMode ? 'Exit selection mode' : 'Select songs'}
                >
                  <MoreToggleIcon />
                </button>
              )}
            </>
          )}
          {isPlaylistView && !showTitleActions && !showTitleLoading && (
            <button
              className="ui-compact-action ui-compact-action--more mobile-selection-toggle"
              onClick={() => {
                if (multiSelect.mobileSelectionMode) multiSelect.exitMobileSelectionMode();
                else multiSelect.enterMobileSelectionMode();
              }}
              aria-label={multiSelect.mobileSelectionMode ? 'Exit selection mode' : 'Select songs'}
              title={multiSelect.mobileSelectionMode ? 'Exit selection mode' : 'Select songs'}
            >
              <MoreToggleIcon />
            </button>
          )}
          {showTitleLoading && (
            <LoadingDots
              active={isViewLoading}
              delayMs={500}
              className="ui-title-loading-indicator ui-title-loading-indicator--mobile mobile-selection-toggle"
              ariaLabel="Loading playlist songs"
            />
          )}
          {showTitleLoading && (
            <LoadingDots
              active={isViewLoading}
              delayMs={500}
              className="ui-title-loading-indicator"
              ariaLabel="Loading playlist songs"
            />
          )}
        </div>
      ) : null}

      {currentView === 'user-songs' && currentViewSongs.length > 0 && (
        <SearchField
          value={searchQuery}
          onValueChange={setSearchQuery}
          className="filter-input"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearchQuery('');
              e.currentTarget.blur();
            } else if (e.key === 'Enter' && searchQuery.trim() && sortedCompleteSongs.length === 0) {
              e.preventDefault();
              void onSearchBarSubmit(searchQuery);
            }
          }}
          action={searchQuery ? {
            label: '×',
            title: 'Clear search',
            className: 'search-field-clear',
            onClick: () => setSearchQuery(''),
          } : undefined}
        />
      )}

      {inlineImportStatus && (
        <div className={`import-status ${inlineImportStatus.type}`}>
          {inlineImportStatus.message}
        </div>
      )}

      {currentView === 'user-songs' && sortedCompleteSongs.length > 0 && (
        <div className="library-sort-header">
          <span
            className={`library-sort-option ${librarySortBy === 'recent' ? 'active' : ''}`}
            onClick={() => {
              if (librarySortBy === 'recent') setLibrarySortDir((dir) => dir === 'asc' ? 'desc' : 'asc');
              else {
                setLibrarySortBy('recent');
                setLibrarySortDir('asc');
              }
            }}
          >
            <span className="library-sort-option-label">RECENT</span>
            <span className={`library-sort-option-indicator ${librarySortBy === 'recent' ? 'visible' : ''}`}>
              {librarySortDir === 'asc' ? '↓' : '↑'}
            </span>
          </span>
          <span
            className={`library-sort-option ${librarySortBy === 'alpha' ? 'active' : ''}`}
            onClick={() => {
              if (librarySortBy === 'alpha') setLibrarySortDir((dir) => dir === 'asc' ? 'desc' : 'asc');
              else {
                setLibrarySortBy('alpha');
                setLibrarySortDir('asc');
              }
            }}
          >
            <span className="library-sort-option-label">A-Z</span>
            <span className={`library-sort-option-indicator ${librarySortBy === 'alpha' ? 'visible' : ''}`}>
              {librarySortDir === 'asc' ? '↑' : '↓'}
            </span>
          </span>
          <button
            className="ui-compact-action ui-compact-action--more mobile-selection-toggle library-sort-more"
            onClick={() => {
              if (multiSelect.mobileSelectionMode) multiSelect.exitMobileSelectionMode();
              else multiSelect.enterMobileSelectionMode();
            }}
            aria-label={multiSelect.mobileSelectionMode ? 'Exit selection mode' : 'Select songs'}
            title={multiSelect.mobileSelectionMode ? 'Exit selection mode' : 'Select songs'}
          >
            <MoreToggleIcon />
          </button>
        </div>
      )}

      <div className="main-content-wrapper">
        <div className="songs-container-full">
          <div className="song-list">
            {sortedCompleteSongs.length > 0 ? (
              <VirtualizedSongList
                songs={sortedCompleteSongs}
                currentSongId={currentSongId}
                focusedSongId={focusedSongId}
                onSongSelect={onSongSelect}
                onAddToQueue={onSongAddToQueue}
                onShareSong={onShareSong ? (e, song) => {
                  e.stopPropagation();
                  void onShareSong(song);
                } : undefined}
                onDeleteSong={onSongDelete}
                onArtistClick={onArtistClick}
                showDeleteButton={!isCurrentPlaylistFromAnotherUser && (!isSharedPlaylist || sharedPlaylistUserId === userId)}
                deleteButtonTitle={currentView === 'user-songs' ? 'Delete song' : 'Remove from playlist'}
                isSelected={multiSelect.isSelected}
                onSelectionClick={multiSelect.handleClick}
                onDragStart={multiSelect.handleDragStart}
                onDragMove={multiSelect.handleDragMove}
                onDragEnd={multiSelect.handleDragEnd}
                hasSelection={multiSelect.selectedCount > 0}
                onRightClickSelect={multiSelect.selectSingle}
                showSelectionTargets={multiSelect.mobileSelectionMode}
                onLongPressAction={multiSelect.mobileSelectionMode || !onShareSong ? undefined : (song) => {
                  void onShareSong(song, { forceClipboard: true });
                }}
              />
            ) : (
              <div className="empty-state">
                {isImporting ? (
                  <span className="text-secondary">Importing songs...</span>
                ) : isInitialLoad || isLoading || isViewLoading ? null : searchQuery.trim() ? (
                  <span className="text-secondary">
                    {searchQuery.includes('http') || searchQuery.includes('spotify.com') || searchQuery.includes('youtu')
                      ? <>Press ENTER to import. Accepts YouTube URLs, public Spotify playlists &amp; albums</>
                      : <>Song not found — ENTER to search &amp; import</>
                    }
                  </span>
                ) : currentView !== 'user-songs' ? (
                  processingSongs.length > 0 ? (
                    <span className="text-secondary">Songs are still converting...</span>
                  ) : (
                    <span className="text-secondary">This playlist is empty. Add some songs to get started!</span>
                  )
                ) : (
                  <span className="text-secondary">No songs yet. Add your first song to get started!</span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className={`action-area ${currentView !== 'user-songs' ? 'action-area--playlist' : ''}`}>
          {!isSharedPlaylist && (!isCurrentPlaylistFromAnotherUser || currentView === 'user-songs') && (
            <div className="action-add-songs">
              <button
                className="add-songs-button"
                onClick={() => setShowAddSongsModal(true)}
              >
                + Add songs
              </button>
              {importProgress && (
                <div className="conversion-result">{importProgress}</div>
              )}
            </div>
          )}

          {isSharedPlaylist && sharedPlaylistUserId !== userId && (
            <div className="shared-playlist-info">
              <p className="text-secondary">You&apos;re listening to a shared playlist</p>
            </div>
          )}

          {isCurrentPlaylistFromAnotherUser && (
            <div className="shared-playlist-info">
              <p className="text-secondary">Listening to a shared playlist</p>
            </div>
          )}

          <ConvertingSection
            processingSongs={processingSongs}
            onRetrySong={onSongRetry}
            onDeleteSong={onSongDelete}
            searchQuery={searchQuery}
          />
        </div>
      </div>

      <AddSongsModal
        isOpen={showAddSongsModal}
        onClose={() => setShowAddSongsModal(false)}
        onSongsAdded={onSongsAdded}
        playlistId={currentView}
        playlistName={currentView === 'user-songs' ? 'Your Library' : currentPlaylistName}
        currentSongs={currentViewSongs}
        mode={currentView === 'user-songs' ? 'user-songs' : 'playlist'}
        onSpotifyUrl={onSpotifyUrl}
      />

      <SelectionActionBar
        selectedCount={multiSelect.selectedCount}
        selectedSong={selectedSong}
        mobileSelectionMode={multiSelect.mobileSelectionMode}
        onAddToPlaylist={() => setShowAddToPlaylistModal(true)}
        onAddToQueue={onMultiSelectQueue}
        onSave={onMultiSelectSave}
        onDelete={onMultiSelectDelete}
        onClear={multiSelect.clearSelection}
        onExitMobileSelectionMode={multiSelect.exitMobileSelectionMode}
        onSongReplaced={onSongReplaced}
      />

      <AddToPlaylistModal
        isOpen={showAddToPlaylistModal}
        onClose={() => setShowAddToPlaylistModal(false)}
        songIds={multiSelect.selectedSongIds()}
        onComplete={onAddToPlaylistComplete}
        onNavigateToPlaylist={onNavigateToPlaylist}
      />
    </>
  );
}
