'use client';

import { useEffect, useRef, useState } from 'react';
import { List, type ListImperativeAPI, type RowComponentProps } from 'react-window';
import { Song } from '@/app/lib/api';
import { decodeHtmlEntities, splitArtistTitle } from '@/app/lib/utils';
import { useTouchActions } from '@/app/hooks/useLongPress';

const SONG_ROW_HEIGHT = 20;

interface VirtualizedSongRowData {
  songs: Song[];
  currentSongId?: string;
  focusedSongId?: string;
  onSongSelect: (song: Song, index: number) => void;
  onAddToQueue: (e: React.MouseEvent, song: Song) => void;
  onDeleteSong?: (e: React.MouseEvent, song: Song) => void;
  onSaveToLibrary?: (e: React.MouseEvent, song: Song) => void;
  onShareSong?: (e: React.MouseEvent, song: Song) => void;
  onArtistClick?: (artistName: string) => void;
  showDeleteButton: boolean;
  deleteButtonTitle: string;
  isSelected?: (songId: string) => boolean;
  onSelectionClick?: (index: number, song: Song, event: React.MouseEvent) => boolean;
  onDragStart?: (index: number) => void;
  onDragMove?: (index: number) => void;
  onRightClickSelect?: (songId: string) => void;
  showSelectionTargets?: boolean;
  onLongPressAction?: (song: Song) => void;
}

const syntheticEvent = { stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent;

function SongRow({ index, style, ...data }: RowComponentProps<VirtualizedSongRowData>) {
  const {
    songs,
    currentSongId,
    focusedSongId,
    onSongSelect,
    onAddToQueue,
    onDeleteSong,
    onSaveToLibrary,
    onShareSong,
    onArtistClick,
    showDeleteButton,
    deleteButtonTitle,
    isSelected,
    onSelectionClick,
    onDragStart,
    onDragMove,
    onRightClickSelect,
    showSelectionTargets,
    onLongPressAction,
  } = data;

  const song = songs[index];
  const selected = isSelected?.(song.song_id) ?? false;
  const canDelete = showDeleteButton && !!onDeleteSong;
  const isActive = currentSongId === song.song_id;

  const handleClick = (e: React.MouseEvent) => {
    if (onSelectionClick?.(index, song, e)) return;
    onSongSelect(song, index);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    onDragStart?.(index);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRightClickSelect) {
      onRightClickSelect(song.song_id);
    }
  };

  const handleMouseEnter = () => {
    onDragMove?.(index);
  };

  const touchHandlers = useTouchActions({
    onSwipeRight: () => onAddToQueue(syntheticEvent, song),
    onSwipeLeft: canDelete ? () => onDeleteSong!(syntheticEvent, song) : undefined,
    onLongPress: onLongPressAction ? () => onLongPressAction(song) : undefined,
  });

  return (
    <div style={style} className="song-row-outer">
      <div
        className={`song-row ${isActive ? 'active' : ''} ${selected ? 'selected' : ''}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onContextMenu={handleContextMenu}
        {...touchHandlers}
      >
        <span className="song-title">
          {(() => {
            const { artist, title } = splitArtistTitle(song);
            if (artist && onArtistClick) {
              return (
                <>
                  <span
                    className="song-title-artist"
                    onClick={(e) => {
                      e.stopPropagation();
                      onArtistClick(artist);
                    }}
                  >
                    {decodeHtmlEntities(artist)}
                  </span>
                  <span className="song-title-dot">·</span>
                  {decodeHtmlEntities(title)}
                </>
              );
            }
            return decodeHtmlEntities(title || song.title || `https://youtube.com/watch?v=${song.song_id}`);
          })()}
        </span>
        {showSelectionTargets ? (
          <div className={`song-select-indicator ${selected ? 'selected' : ''}`} aria-hidden="true" />
        ) : (
          <div className="song-actions">
            {onShareSong && (
              <button
                className="song-queue-btn"
                onClick={(e) => onShareSong(e, song)}
                title="Copy share link"
                aria-label="Copy share link"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                  <polyline points="16,6 12,2 8,6" />
                  <line x1="12" y1="2" x2="12" y2="15" />
                </svg>
              </button>
            )}
            {onSaveToLibrary && (
              <button
                className="song-queue-btn"
                onClick={(e) => onSaveToLibrary(e, song)}
                title="Save to library"
              >
                +
              </button>
            )}
            <button
              className="song-queue-btn arrow-btn"
              onClick={(e) => onAddToQueue(e, song)}
              title="Add to queue"
            >
              &rarr;
            </button>
            {showDeleteButton && onDeleteSong && (
              <button
                className="song-delete-btn"
                onClick={(e) => onDeleteSong(e, song)}
                title={deleteButtonTitle}
              >
                &times;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface VirtualizedSongListProps {
  songs: Song[];
  currentSongId?: string;
  focusedSongId?: string;
  onSongSelect: (song: Song, index: number) => void;
  onAddToQueue: (e: React.MouseEvent, song: Song) => void;
  onDeleteSong?: (e: React.MouseEvent, song: Song) => void;
  onSaveToLibrary?: (e: React.MouseEvent, song: Song) => void;
  onShareSong?: (e: React.MouseEvent, song: Song) => void;
  onArtistClick?: (artistName: string) => void;
  showDeleteButton?: boolean;
  deleteButtonTitle?: string;
  isSelected?: (songId: string) => boolean;
  onSelectionClick?: (index: number, song: Song, event: React.MouseEvent) => boolean;
  onDragStart?: (index: number) => void;
  onDragMove?: (index: number) => void;
  onDragEnd?: () => boolean;
  hasSelection?: boolean;
  onRightClickSelect?: (songId: string) => void;
  showSelectionTargets?: boolean;
  onLongPressAction?: (song: Song) => void;
}

export function VirtualizedSongList({
  songs,
  currentSongId,
  focusedSongId,
  onSongSelect,
  onAddToQueue,
  onDeleteSong,
  onSaveToLibrary,
  onShareSong,
  onArtistClick,
  showDeleteButton = false,
  deleteButtonTitle = '',
  isSelected,
  onSelectionClick,
  onDragStart,
  onDragMove,
  onDragEnd,
  hasSelection,
  onRightClickSelect,
  showSelectionTargets,
  onLongPressAction,
}: VirtualizedSongListProps) {
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastAutoScrollTargetRef = useRef<string | null>(null);
  const [listHeight, setListHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const h = el.clientHeight;
      if (h > 0) {
        setListHeight(h);
      }
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const scrollTargetSongId = focusedSongId || currentSongId;
    if (!scrollTargetSongId || !listRef.current) {
      lastAutoScrollTargetRef.current = null;
      return;
    }

    const autoScrollTargetKey = `${focusedSongId ? 'focus' : 'play'}:${scrollTargetSongId}`;
    if (lastAutoScrollTargetRef.current === autoScrollTargetKey) {
      return;
    }

    const currentIndex = songs.findIndex((song) => song.song_id === scrollTargetSongId);
    if (currentIndex === -1) {
      return;
    }

    listRef.current.scrollToRow({ index: currentIndex, align: 'smart' });
    lastAutoScrollTargetRef.current = autoScrollTargetKey;
  }, [currentSongId, focusedSongId, songs]);

  useEffect(() => {
    const handleMouseUp = () => {
      onDragEnd?.();
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [onDragEnd]);

  return (
    <div ref={containerRef} className={`virtualized-song-list virtualized-song-list--fill ${hasSelection ? 'has-selection' : ''}`}>
      <List
        listRef={listRef}
        rowComponent={SongRow}
        rowCount={songs.length}
        rowHeight={SONG_ROW_HEIGHT}
        rowProps={{
          songs,
          currentSongId,
          focusedSongId,
          onSongSelect,
          onAddToQueue,
          onDeleteSong,
          onSaveToLibrary,
          onShareSong,
          onArtistClick,
          showDeleteButton,
          deleteButtonTitle,
          isSelected,
          onSelectionClick,
          onDragStart,
          onDragMove,
          onRightClickSelect,
          showSelectionTargets,
          onLongPressAction,
        }}
        style={{ height: listHeight }}
      />
    </div>
  );
}
