'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Song } from '@/app/lib/api';

interface UseMultiSelectOptions {
  songs: Song[];
  currentSongId?: string;
  onViewChange?: string;
}

export function useMultiSelect({ songs, currentSongId, onViewChange }: UseMultiSelectOptions) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const dragStartIndex = useRef<number | null>(null);
  const isDragging = useRef(false);
  const hasDragMoved = useRef(false);

  // Clear selection on view change
  useEffect(() => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
  }, [onViewChange]);

  // Escape key clears selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedIds.size > 0) {
        setSelectedIds(new Set());
        setLastClickedIndex(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds.size]);

  // Returns true if the click was handled as a selection action
  const handleClick = useCallback((index: number, song: Song, event: React.MouseEvent): boolean => {
    // Desktop only guard
    if (window.innerWidth <= 768) return false;

    const isCmd = event.metaKey || event.ctrlKey;
    const isShift = event.shiftKey;

    if (!isCmd && !isShift) return false;

    event.preventDefault();
    event.stopPropagation();

    if (isCmd) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(song.song_id)) {
          next.delete(song.song_id);
        } else {
          next.add(song.song_id);
        }
        return next;
      });
      setLastClickedIndex(index);
    } else if (isShift) {
      // Use lastClickedIndex, or fall back to currently playing song's index
      let anchorIndex = lastClickedIndex;
      if (anchorIndex === null && currentSongId) {
        anchorIndex = songs.findIndex(s => s.song_id === currentSongId);
        if (anchorIndex === -1) anchorIndex = null;
      }

      if (anchorIndex !== null) {
        const start = Math.min(anchorIndex, index);
        const end = Math.max(anchorIndex, index);
        const next = new Set<string>();
        for (let i = start; i <= end; i++) {
          if (songs[i]) next.add(songs[i].song_id);
        }
        setSelectedIds(next);
      } else {
        // No anchor at all, just select this one
        setSelectedIds(new Set([song.song_id]));
      }
      setLastClickedIndex(index);
    }

    return true;
  }, [currentSongId, lastClickedIndex, songs]);

  const handleDragStart = useCallback((index: number) => {
    if (window.innerWidth <= 768) return;
    dragStartIndex.current = index;
    isDragging.current = true;
    hasDragMoved.current = false;
  }, []);

  const handleDragMove = useCallback((index: number) => {
    if (!isDragging.current || dragStartIndex.current === null) return;
    if (window.innerWidth <= 768) return;

    hasDragMoved.current = true;
    const start = Math.min(dragStartIndex.current, index);
    const end = Math.max(dragStartIndex.current, index);
    const next = new Set<string>();
    for (let i = start; i <= end; i++) {
      if (songs[i]) next.add(songs[i].song_id);
    }
    setSelectedIds(next);
    setLastClickedIndex(index);
  }, [songs]);

  const handleDragEnd = useCallback(() => {
    const didDrag = hasDragMoved.current;
    isDragging.current = false;
    dragStartIndex.current = null;
    hasDragMoved.current = false;
    return didDrag;
  }, []);

  const selectSingle = useCallback((songId: string) => {
    setSelectedIds(new Set([songId]));
    const idx = songs.findIndex(s => s.song_id === songId);
    setLastClickedIndex(idx !== -1 ? idx : null);
  }, [songs]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastClickedIndex(null);
  }, []);

  const isSelected = useCallback((songId: string) => {
    return selectedIds.has(songId);
  }, [selectedIds]);

  const selectedSongIds = useCallback(() => {
    return Array.from(selectedIds);
  }, [selectedIds]);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    handleClick,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
    selectSingle,
    clearSelection,
    isSelected,
    selectedSongIds,
    isDragging,
  };
}
