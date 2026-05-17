'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { List, type ListImperativeAPI, type RowComponentProps } from 'react-window';
import { Song } from '@/app/lib/api';
import { decodeHtmlEntities, splitArtistTitle } from '@/app/lib/utils';
import { useTouchActions } from '@/app/hooks/useLongPress';

const SONG_ROW_HEIGHT = 20;

interface VirtualizedSongRowData {
  songs: Song[];
  currentSongId?: string;
  onSongSelect: (song: Song, index: number) => void;
  onAddToQueue: (e: React.MouseEvent, song: Song) => void;
  onDeleteSong?: (e: React.MouseEvent, song: Song) => void;
  onSaveToLibrary?: (e: React.MouseEvent, song: Song) => void;
  onArtistClick?: (artistName: string) => void;
  showDeleteButton: boolean;
  deleteButtonTitle: string;
  isSelected?: (songId: string) => boolean;
  onSelectionClick?: (index: number, song: Song, event: React.MouseEvent) => boolean;
  onDragStart?: (index: number) => void;
  onDragMove?: (index: number) => void;
  onRightClickSelect?: (songId: string) => void;
}

const syntheticEvent = { stopPropagation: () => {}, preventDefault: () => {} } as React.MouseEvent;

function SongRow({ index, style, ...data }: RowComponentProps<VirtualizedSongRowData>) {
  const {
    songs,
    currentSongId,
    onSongSelect,
    onAddToQueue,
    onDeleteSong,
    onSaveToLibrary,
    onArtistClick,
    showDeleteButton,
    deleteButtonTitle,
    isSelected,
    onSelectionClick,
    onDragStart,
    onDragMove,
    onRightClickSelect,
  } = data;

  const song = songs[index];
  const selected = isSelected?.(song.song_id) ?? false;
  const canDelete = showDeleteButton && !!onDeleteSong;

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
    onLongPress: onSaveToLibrary ? () => onSaveToLibrary(syntheticEvent, song) : undefined,
  });

  return (
    <div style={style} className="song-row-outer">
      <div
        className={`song-row ${currentSongId === song.song_id ? 'active' : ''} ${selected ? 'selected' : ''}`}
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
        <div className="song-actions">
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
      </div>
    </div>
  );
}

interface VirtualizedSongListProps {
  songs: Song[];
  currentSongId?: string;
  onSongSelect: (song: Song, index: number) => void;
  onAddToQueue: (e: React.MouseEvent, song: Song) => void;
  onDeleteSong?: (e: React.MouseEvent, song: Song) => void;
  onSaveToLibrary?: (e: React.MouseEvent, song: Song) => void;
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
}

export function VirtualizedSongList({
  songs,
  currentSongId,
  onSongSelect,
  onAddToQueue,
  onDeleteSong,
  onSaveToLibrary,
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
}: VirtualizedSongListProps) {
  const listRef = useRef<ListImperativeAPI>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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
    if (currentSongId && listRef.current) {
      const currentIndex = songs.findIndex((song) => song.song_id === currentSongId);
      if (currentIndex !== -1) {
        listRef.current.scrollToRow({ index: currentIndex, align: 'smart' });
      }
    }
  }, [currentSongId, songs]);

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
          onSongSelect,
          onAddToQueue,
          onDeleteSong,
          onSaveToLibrary,
          onArtistClick,
          showDeleteButton,
          deleteButtonTitle,
          isSelected,
          onSelectionClick,
          onDragStart,
          onDragMove,
          onRightClickSelect,
        }}
        style={{ height: listHeight }}
      />
    </div>
  );
}
