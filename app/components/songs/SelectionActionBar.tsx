'use client';

import { useEffect, useRef, useState } from 'react';
import { Song, replaceSong } from '@/app/lib/api';
import { InlineActionInput } from '@/app/components/common/InlineActionInput';

interface SelectionActionBarProps {
  selectedCount: number;
  selectedSong?: Song;
  onAddToPlaylist: () => void;
  onAddToQueue: () => void;
  onSave?: () => void;
  onDelete?: () => void;
  onClear: () => void;
  onSongReplaced?: () => void;
}

export function SelectionActionBar({
  selectedCount,
  selectedSong,
  onAddToPlaylist,
  onAddToQueue,
  onSave,
  onDelete,
  onClear,
  onSongReplaced,
}: SelectionActionBarProps) {
  const [isDesktop, setIsDesktop] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [replaceUrl, setReplaceUrl] = useState('');
  const [replaceState, setReplaceState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [replaceError, setReplaceError] = useState('');
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lock in the song ID when entering replace mode — don't read from the prop at submit
  // time since songs can auto-refresh and change selectedSong underneath the form.
  const replacingSongIdRef = useRef<string | null>(null);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth > 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Exit replace mode when selection changes
  useEffect(() => {
    setReplaceMode(false);
    setReplaceUrl('');
    setReplaceState('idle');
    setReplaceError('');
  }, [selectedCount]);

  // Keyboard shortcuts when selection is active (skip when in replace mode)
  useEffect(() => {
    if (!isDesktop || selectedCount === 0 || replaceMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Enter') {
        e.preventDefault();
        onAddToQueue();
      } else if (e.key === 'Backspace' && onDelete) {
        e.preventDefault();
        onDelete();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDesktop, selectedCount, replaceMode, onAddToQueue, onDelete]);

  // Escape exits replace mode (not the whole selection)
  useEffect(() => {
    if (!replaceMode) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        exitReplaceMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [replaceMode]);

  if (!isDesktop || selectedCount === 0) return null;

  function exitReplaceMode() {
    setReplaceMode(false);
    setReplaceUrl('');
    setReplaceState('idle');
    setReplaceError('');
    replacingSongIdRef.current = null;
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
  }

  async function handleReplaceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!replaceUrl.trim() || replaceState === 'loading') return;

    const songId = replacingSongIdRef.current;
    if (!songId) return;

    setReplaceState('loading');
    try {
      await replaceSong(songId, replaceUrl);
      exitReplaceMode();
      onClear();
      onSongReplaced?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "songs don't match";
      setReplaceState('error');
      setReplaceError(msg);
      errorTimerRef.current = setTimeout(() => { setReplaceState('idle'); setReplaceError(''); }, 3000);
    }
  }

  const showReplaceButton = selectedCount === 1 && selectedSong?.status === 'COMPLETE';

  if (replaceMode) {
    return (
      <InlineActionInput
        variant="selection"
        className="selection-action-bar"
        placeholder="YouTube link"
        value={replaceState === 'error' ? replaceError : replaceUrl}
        onValueChange={(value) => {
          setReplaceUrl(value);
          setReplaceState('idle');
          setReplaceError('');
        }}
        onSubmit={handleReplaceSubmit}
        onCancel={() => { exitReplaceMode(); onClear(); }}
        submitLabel={replaceState === 'loading' ? '…' : '→'}
        disabled={replaceState === 'loading'}
        submitDisabled={replaceState === 'loading'}
        autoFocus
      />
    );
  }

  return (
    <div className="selection-action-bar">
      <span className="selection-count">{selectedCount} selected</span>
      <button className="ui-inline-button" onClick={onAddToPlaylist}>
        Add to playlist
      </button>
      <button className="ui-inline-button" onClick={onAddToQueue}>
        Queue
      </button>
      {onSave && (
        <button className="ui-inline-button" onClick={onSave}>
          Save
        </button>
      )}
      {showReplaceButton && (
        <button className="ui-inline-button" onClick={() => { replacingSongIdRef.current = selectedSong!.song_id; setReplaceMode(true); }}>
          Replace
        </button>
      )}
      {onDelete && (
        <button className="ui-inline-button ui-inline-button--danger" onClick={onDelete}>
          Delete
        </button>
      )}
      <button className="ui-inline-button ui-inline-button--dismiss" onClick={onClear}>
        &times;
      </button>
    </div>
  );
}
