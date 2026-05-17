'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { usePlaylistContext, UserPlaylist } from '@/app/contexts/PlaylistContext';
import { SearchField } from '@/app/components/common/SearchField';

interface AddToPlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  songIds: string[];
  onComplete: () => void;
  onNavigateToPlaylist?: (playlistId: string, playlistName: string, songIds?: string[]) => void;
}

export function AddToPlaylistModal({ isOpen, onClose, songIds, onComplete, onNavigateToPlaylist }: AddToPlaylistModalProps) {
  const { userPlaylists, addSongsToPlaylist, createPlaylistWithSongs, loadPlaylists } = usePlaylistContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setLoading(false);
    }
  }, [isOpen]);

  const handlePlaylistClick = async (playlist: UserPlaylist) => {
    if (loading) return;
    setLoading(true);
    try {
      await addSongsToPlaylist(playlist.playlist_id, songIds);
      await loadPlaylists();
      onComplete();
      onClose();
    } catch (err) {
      console.error('Failed to add songs to playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    const playlistName = searchQuery.trim();
    if (!playlistName || loading) return;
    setLoading(true);
    try {
      const playlistId = await createPlaylistWithSongs(playlistName, songIds);
      await loadPlaylists();
      onComplete();
      onClose();
      onNavigateToPlaylist?.(playlistId, playlistName, songIds);
    } catch (err) {
      console.error('Failed to create playlist:', err);
    } finally {
      setLoading(false);
      setSearchQuery('');
    }
  };

  const regularPlaylists = useMemo(() => {
    return userPlaylists.filter(p => !p.artist_name && p.playlist_name && p.playlist_name.trim());
  }, [userPlaylists]);

  const filteredPlaylists = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return regularPlaylists;
    return regularPlaylists.filter(playlist =>
      playlist.playlist_name.toLowerCase().includes(normalizedQuery)
    );
  }, [regularPlaylists, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay add-to-playlist-overlay" onClick={onClose}>
      <div className="modal-content add-to-playlist-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-body ui-modal-body--compact add-to-playlist-body">
          <div className="add-to-playlist-search">
            <SearchField
              inputRef={inputRef}
              value={searchQuery}
              onValueChange={setSearchQuery}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchQuery('');
                  e.currentTarget.blur();
                } else if (e.key === 'Enter' && searchQuery.trim()) {
                  e.preventDefault();
                  void handleCreatePlaylist();
                }
              }}
            />
          </div>

          {regularPlaylists.length > 0 && (
            <div className="modal-list add-to-playlist-list">
              {filteredPlaylists.length > 0 ? (
                filteredPlaylists.map(playlist => (
                  <div
                    key={playlist.playlist_id}
                    className={`modal-list-item ${loading ? 'loading' : ''}`}
                    onClick={() => handlePlaylistClick(playlist)}
                  >
                    <div className="item-info">
                      <div className="item-title">{playlist.playlist_name}</div>
                    </div>
                    <div className="add-to-playlist-count">{playlist.song_count} song{playlist.song_count !== 1 ? 's' : ''}</div>
                  </div>
                ))
              ) : (
                <div className="empty-state ui-empty-state--compact">
                  <span className="no-playlists-text">No matching playlists</span>
                </div>
              )}
            </div>
          )}

          <div className="add-to-playlist-create-row">
            <button
              className="ui-panel-button ui-panel-button--primary ui-nowrap add-to-playlist-cancel-button"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="ui-panel-button ui-panel-button--primary ui-nowrap add-to-playlist-create-button"
              onClick={handleCreatePlaylist}
              disabled={!searchQuery.trim() || loading}
            >
              + NEW
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
