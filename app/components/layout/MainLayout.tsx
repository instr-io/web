'use client';

import { CSSProperties, ReactNode, useState } from 'react';
import { Player } from '@/app/components/player/Player';
import { QueueModal } from '@/app/components/queue/QueueModal';
import { UserProfile } from '@/app/components/auth/UserProfile';
import { MobileMenu } from '@/app/components/layout/MobileMenu';
import { Song } from '@/app/lib/api';
import { VolumeControl } from '../player/VolumeControl';
import { usePopup } from '@/app/lib/usePopup';
import { decodeHtmlEntities, splitArtistTitle } from '@/app/lib/utils';
import { UserPlaylist } from '@/app/contexts/PlaylistContext';
import { usePlaylistSidebar } from '@/app/hooks/usePlaylistSidebar';

interface MainLayoutProps {
  children: ReactNode;
  currentSong?: Song;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (progress: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onPlaylistSelect?: (playlistId: string, originalUserId?: string) => void;
  onPlaylistCreated?: (playlistId: string, playlistName: string, songIds?: string[]) => void;
  onPlaylistDeleted?: () => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isSharedPlaylist?: boolean;
  onLoadQueue?: () => Promise<void>;
  isShuffled?: boolean;
  setIsShuffled?: (value: boolean) => void;
  repeatAll?: boolean;
  setRepeatAll?: (value: boolean) => void;
  repeatOne?: boolean;
  setRepeatOne?: (value: boolean) => void;
  rebuildUnofficialQueue?: (shuffleOverride?: boolean) => Promise<void>;
  onNowPlayingClick?: () => void;
  onArtistClick?: (artistName: string) => void;
  onHomeClick?: () => void;
  sidebarSearchQuery?: string;
  compactMobilePlayerSpacing?: boolean;
}

interface PlaylistSidebarItemProps {
  playlist: UserPlaylist;
  onSelect: (playlistId: string, originalUserId?: string) => void;
  onShare: (event: React.MouseEvent, playlistId: string, originalUserId?: string) => void;
  onDelete: (event: React.MouseEvent, playlistId: string) => void;
}

function PlaylistSidebarItem({ playlist, onSelect, onShare, onDelete }: PlaylistSidebarItemProps) {
  return (
    <div className="playlist-row">
      <button
        className="playlist-link playlist-row-link"
        onClick={() => onSelect(playlist.playlist_id, playlist.original_user_id)}
      >
        {playlist.playlist_name}
      </button>
      <button
        className="playlist-share-btn"
        onClick={(event) => onShare(event, playlist.playlist_id, playlist.original_user_id)}
        title="Share playlist"
        aria-label={`Share ${playlist.playlist_name}`}
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16,6 12,2 8,6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
      </button>
      <button
        className="playlist-delete-btn"
        onClick={(event) => onDelete(event, playlist.playlist_id)}
        title="Delete playlist"
        aria-label={`Delete ${playlist.playlist_name}`}
      >
        ×
      </button>
    </div>
  );
}

interface PlaylistSidebarPanelProps {
  visiblePlaylists: UserPlaylist[];
  hasSearchQuery: boolean;
  onLibraryClick: () => void;
  onDiscoverClick: () => void;
  onCreatePlaylist: () => void;
  onPlaylistSelect: (playlistId: string, originalUserId?: string) => void;
  onSharePlaylist: (event: React.MouseEvent, playlistId: string, originalUserId?: string) => void;
  onDeletePlaylist: (event: React.MouseEvent, playlistId: string) => void;
  onStatsClick: () => void;
  onAboutClick: () => void;
  onQueueClick: () => void;
  footer?: ReactNode;
  footerClassName?: string;
}

function PlaylistSidebarPanel({
  visiblePlaylists,
  hasSearchQuery,
  onLibraryClick,
  onDiscoverClick,
  onCreatePlaylist,
  onPlaylistSelect,
  onSharePlaylist,
  onDeletePlaylist,
  onStatsClick,
  onAboutClick,
  onQueueClick,
  footer,
  footerClassName,
}: PlaylistSidebarPanelProps) {
  const footerContent = footer ?? (
    <div className="sidebar-bottom-row">
      <button className="queue-button ui-text-left" onClick={onStatsClick}>
        STATS
      </button>
      <button className="queue-button ui-text-center" onClick={onAboutClick}>
        ABOUT
      </button>
      <button className="queue-button" onClick={onQueueClick}>
        QUEUE
      </button>
    </div>
  );

  return (
    <>
      <button className="playlist-link sidebar-nav" onClick={onLibraryClick}>
        YOUR LIBRARY
      </button>
      <button className="playlist-link sidebar-nav" onClick={onDiscoverClick}>
        ALL ARTISTS
      </button>

      <h2 className="playlist-title">SAVED</h2>
      <button className="create-playlist" onClick={onCreatePlaylist}>
        + CREATE PLAYLIST
      </button>

      <div className="playlists-scroll-container no-scrollbar">
        {visiblePlaylists.length > 0 ? (
          visiblePlaylists.map((playlist) => (
            <PlaylistSidebarItem
              key={playlist.playlist_id}
              playlist={playlist}
              onSelect={onPlaylistSelect}
              onShare={onSharePlaylist}
              onDelete={onDeletePlaylist}
            />
          ))
        ) : (
          <div className="no-playlists">
            <span className="no-playlists-text">
              {hasSearchQuery ? 'No matching playlists' : 'No playlists yet'}
            </span>
          </div>
        )}
      </div>

      {footerClassName ? <div className={footerClassName}>{footerContent}</div> : footerContent}
    </>
  );
}

export function MainLayout({
  children,
  currentSong,
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onNext,
  onPrevious,
  onPlaylistSelect,
  onPlaylistCreated,
  onPlaylistDeleted,
  audioRef,
  isSharedPlaylist = false,
  onLoadQueue,
  isShuffled,
  setIsShuffled,
  repeatAll,
  setRepeatAll,
  repeatOne,
  setRepeatOne,
  rebuildUnofficialQueue,
  onNowPlayingClick,
  onArtistClick,
  onHomeClick,
  sidebarSearchQuery = '',
  compactMobilePlayerSpacing = false,
}: MainLayoutProps) {
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const { showCopiedPopup, popupMessage, popupDuration, showPopup } = usePopup();
  const {
    normalizedSidebarSearchQuery,
    visiblePlaylists,
    handleCreateBlankPlaylist,
    handleDeletePlaylist,
    handleSharePlaylist,
  } = usePlaylistSidebar({
    sidebarSearchQuery,
    onPlaylistCreated,
    onPlaylistDeleted,
    showPopup,
  });

  const handlePlaylistClick = (playlistId: string, originalUserId?: string) => {
    if (onPlaylistSelect) {
      onPlaylistSelect(playlistId, originalUserId);
    }
  };

  return (
    <div className="outer-container">
      <header className="site-header">
        <div className="ui-row ui-row--center ui-row--gap-lg">
          <MobileMenu>
            <PlaylistSidebarPanel
              visiblePlaylists={visiblePlaylists}
              hasSearchQuery={Boolean(normalizedSidebarSearchQuery)}
              onLibraryClick={() => onPlaylistSelect?.('all-songs')}
              onDiscoverClick={() => onPlaylistSelect?.('discover')}
              onCreatePlaylist={handleCreateBlankPlaylist}
              onPlaylistSelect={handlePlaylistClick}
              onSharePlaylist={handleSharePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onStatsClick={() => onPlaylistSelect?.('stats')}
              onAboutClick={() => onPlaylistSelect?.('model')}
              onQueueClick={() => setIsQueueModalOpen(true)}
            />
          </MobileMenu>
          <h1 
            className="ui-clickable"
            onClick={() => onHomeClick ? onHomeClick() : window.location.href = window.location.origin}
            title="Go to main page"
          >
            instr.io
          </h1>
        </div>
        {currentSong && (() => {
          const { artist, title } = splitArtistTitle(currentSong);
          return (
            <div
              className="now-playing"
              title="Go to playing source"
            >
              {artist ? (
                <>
                  <span
                    className="now-playing-artist"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArtistClick?.(artist);
                    }}
                  >
                    {decodeHtmlEntities(artist)}
                  </span>
                  <span className="now-playing-dot">·</span>
                  <span
                    className="now-playing-title ui-clickable"
                    onClick={onNowPlayingClick}
                  >
                    {decodeHtmlEntities(title)}
                  </span>
                </>
              ) : (
                <span
                  className="now-playing-title ui-clickable"
                  onClick={onNowPlayingClick}
                >
                  {decodeHtmlEntities(title)}
                </span>
              )}
            </div>
          );
        })()}
        <UserProfile onAboutClick={() => setIsAboutModalOpen(true)} />
      </header>

      {/* Mobile current song display under header */}
      {currentSong && (() => {
        const { artist: mArtist, title: mTitle } = splitArtistTitle(currentSong);
        return (
          <div
            className="mobile-current-song"
            title="Go to playing source"
          >
            ♪{' '}
            {mArtist ? (
              <>
                <span
                  className="now-playing-artist"
                  onClick={(e) => {
                    e.stopPropagation();
                    onArtistClick?.(mArtist);
                  }}
                >
                  {decodeHtmlEntities(mArtist)}
                </span>
                <span className="now-playing-dot">·</span>
                <span
                  className="now-playing-title ui-clickable"
                  onClick={onNowPlayingClick}
                >
                  {decodeHtmlEntities(mTitle)}
                </span>
              </>
            ) : (
              <span
                className="now-playing-title ui-clickable"
                onClick={onNowPlayingClick}
              >
                {decodeHtmlEntities(mTitle)}
              </span>
            )}
          </div>
        );
      })()}

      <div className="app-container">
        <main className="main-content">
          {children}
        </main>

          <aside className="playlists">
            <PlaylistSidebarPanel
              visiblePlaylists={visiblePlaylists}
              hasSearchQuery={Boolean(normalizedSidebarSearchQuery)}
              onLibraryClick={() => onPlaylistSelect?.('all-songs')}
              onDiscoverClick={() => onPlaylistSelect?.('discover')}
              onCreatePlaylist={handleCreateBlankPlaylist}
              onPlaylistSelect={handlePlaylistClick}
              onSharePlaylist={handleSharePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onStatsClick={() => onPlaylistSelect?.('stats')}
              onAboutClick={() => onPlaylistSelect?.('model')}
              onQueueClick={() => setIsQueueModalOpen(true)}
              footerClassName="sidebar-bottom"
              footer={
                <>
                  <div className="sidebar-bottom-row">
                    <button className="queue-button ui-text-left" onClick={() => onPlaylistSelect?.('stats')}>
                      STATS
                    </button>
                    <button className="queue-button ui-text-center" onClick={() => onPlaylistSelect?.('model')}>
                      ABOUT
                    </button>
                    <button className="queue-button" onClick={() => setIsQueueModalOpen(true)}>
                      QUEUE
                    </button>
                  </div>
                  <div className="ui-margin-top-md">
                    <VolumeControl audioRef={audioRef} />
                  </div>
                </>
              }
            />
          </aside>
      </div>

      <Player
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onPlayPause={onPlayPause}
        onSeek={onSeek}
        onNext={onNext}
        onPrevious={onPrevious}
        onLoadQueue={onLoadQueue}
        isShuffled={isShuffled}
        setIsShuffled={setIsShuffled}
        repeatAll={repeatAll}
        setRepeatAll={setRepeatAll}
        repeatOne={repeatOne}
        setRepeatOne={setRepeatOne}
        rebuildUnofficialQueue={rebuildUnofficialQueue}
        compactMobileSpacing={compactMobilePlayerSpacing}
      />

      <QueueModal
        isOpen={isQueueModalOpen}
        onClose={() => setIsQueueModalOpen(false)}
      />


      {/* About Modal */}
      {isAboutModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAboutModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="ui-panel-title">About instr.io</h2>
              <button className="modal-close" onClick={() => setIsAboutModalOpen(false)}>×</button>
            </div>
            <div className="modal-body ui-panel-copy">
              <p>instr.io turns imported songs into streamable instrumentals. This frontend handles library management, playlist workflows, discovery, and playback while the backend pipeline downloads audio and runs source separation.</p>
            </div>
          </div>
        </div>
      )}

      {/* Ephemeral "Copied to clipboard" popup */}
      {showCopiedPopup && (
        <div className="copied-popup" style={{ '--popup-duration': `${popupDuration}ms` } as CSSProperties}>
          {popupMessage}
        </div>
      )}
    </div>
  );
} 
