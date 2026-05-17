'use client';

import { useState, useEffect } from 'react';
import { Song } from '@/app/lib/api';
import { useImport } from '@/app/lib/useImport';
import { InlineActionInput } from '@/app/components/common/InlineActionInput';
import { LoadingDots } from '@/app/components/common/LoadingDots';
import '@/app/styles/modal.css';

interface AddSongsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSongsAdded: () => void;
  playlistId: string;
  playlistName: string;
  currentSongs: Song[];
  mode?: 'user-songs' | 'playlist';
  onSpotifyUrl?: (url: string) => void;
}

export function AddSongsModal({
  isOpen,
  onClose,
  onSongsAdded,
  playlistId,
  currentSongs,
  mode = 'playlist',
  onSpotifyUrl,
}: AddSongsModalProps) {
  const [importUrl, setImportUrl] = useState('');

  const {
    doImport,
    isImporting,
    status,
    setStatus,
  } = useImport({
    playlistId: mode === 'playlist' ? playlistId : undefined,
    currentSongs,
    onSongsAdded,
    onSpotifyUrl: mode === 'user-songs' ? (url) => { onSpotifyUrl?.(url); onClose(); } : undefined,
    onDone: () => setImportUrl(''),
  });

  useEffect(() => {
    if (isOpen) {
      setImportUrl('');
      setStatus(null);
    }
  }, [isOpen, setStatus]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim() || isImporting) return;
    await doImport(importUrl);
  };

  if (!isOpen) return null;

  const placeholder = 'Paste link or search';
  const errorStatus = status?.type === 'error' ? status : null;
  const loadingIndicator = <LoadingDots className="compact-import-loading-indicator" ariaLabel="Adding songs" />;

  return (
    <div className="modal-overlay compact-import-overlay" onClick={onClose}>
      <div className="compact-import-modal" onClick={e => e.stopPropagation()}>
        <InlineActionInput
          variant="overlay"
          placeholder={placeholder}
          value={importUrl}
          onValueChange={setImportUrl}
          onSubmit={handleImportSubmit}
          onCancel={onClose}
          submitLabel={isImporting ? loadingIndicator : '→'}
          disabled={isImporting}
          submitDisabled={!importUrl.trim() || isImporting}
          autoFocus
        />
        {errorStatus && (
          <div className="compact-import-status error compact-import-desktop-status">
            {errorStatus.message}
          </div>
        )}
      </div>
    </div>
  );
}
