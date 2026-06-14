'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { getArtists, getArtistSongs, Artist, ArtistSong, Song } from '@/app/lib/api';
import { decodeHtmlEntities, splitArtistTitle } from '@/app/lib/utils';
import { shareToClipboard } from '@/app/lib/share';
import { VirtualizedSongList } from '@/app/components/songs/VirtualizedSongList';
import { ConvertingSection } from '@/app/components/queue/ConvertingSection';
import { SearchField } from '@/app/components/common/SearchField';

// Regex mirrors Go's NormalizeTitle — strips YouTube suffixes for dedup.
const TITLE_SUFFIX_RE = /[\(\[]\s*(?:official\s+(?:(?:music|hd|4k|hq|8k|full)\s+)*(?:video|audio|lyric\s+video|visualizer)|music\s+video|lyric\s+video|visualizer|audio|video|mv|m\/v|4k|hd|hq|8k)\s*[\)\]]/gi;
const UNBRACKETED_SUFFIX_RE = /\s+(?:official\s+(?:(?:music|hd|4k|hq|8k|full)\s+)*(?:video|audio|lyric\s+video|visualizer)|music\s+video|lyric\s+video)\s*$/i;
const TRAILING_TOPIC_RE = /\s*-\s*Topic\s*$/i;
const TRAILING_DASH_RE = /\s*-\s*$/;
const MULTI_SPACE_RE = /\s{2,}/g;
const STALE_PROCESSING_WINDOW_SECONDS = 48 * 60 * 60;

function MoreToggleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="19" cy="12" r="1.6" />
    </svg>
  );
}

function normalizeTitle(title: string): string {
  let t = title.replace(TITLE_SUFFIX_RE, '');
  t = t.replace(UNBRACKETED_SUFFIX_RE, '');
  t = t.replace(TRAILING_TOPIC_RE, '');
  t = t.replace(TRAILING_DASH_RE, '');
  t = t.replace(MULTI_SPACE_RE, ' ');
  return t.trim().toLowerCase();
}

function stripArtistPrefix(title: string, artist?: string): string {
  if (!artist) return title;
  const prefix = artist.toLowerCase() + ' - ';
  const lower = title.toLowerCase();
  if (lower.startsWith(prefix)) {
    return title.slice(prefix.length);
  }
  return title;
}

function deduplicateSongs(songs: ArtistSong[]): ArtistSong[] {
  const groups = new Map<string, ArtistSong>();
  for (const song of songs) {
    const raw = song.title || song.song_id;
    const key = normalizeTitle(stripArtistPrefix(raw, song.artist));
    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, song);
    } else {
      // Prefer COMPLETE over non-COMPLETE; among same status prefer newer
      const existingComplete = existing.status === 'COMPLETE' ? 1 : 0;
      const songComplete = song.status === 'COMPLETE' ? 1 : 0;
      if (songComplete > existingComplete || (songComplete === existingComplete && (song.created_at ?? 0) > (existing.created_at ?? 0))) {
        groups.set(key, song);
      }
    }
  }
  return Array.from(groups.values());
}

interface DiscoverViewProps {
  onSongSelect: (song: ArtistSong, allSongs: ArtistSong[], artistName: string | null) => void;
  onAddToQueue: (e: React.MouseEvent, song: Song) => void;
  onSaveToLibrary: (e: React.MouseEvent, song: Song) => void;
  onSaveAsPlaylist: (artistName: string, songs: ArtistSong[]) => void;
  onUnsaveArtist?: (artistName: string) => void;
  savedArtists?: string[];
  initialArtist?: string | null;
  currentSongId?: string;
  focusedSongId?: string;
  isSelected?: (songId: string) => boolean;
  onSelectionClick?: (index: number, song: Song, event: React.MouseEvent) => boolean;
  onDragStart?: (index: number) => void;
  onDragMove?: (index: number) => void;
  onDragEnd?: () => boolean;
  hasSelection?: boolean;
  onRightClickSelect?: (songId: string) => void;
  onArtistSongsChanged?: (songs: Song[]) => void;
  onQueueAll?: (songIds: string[]) => void;
  showPopup?: (msg: string, duration?: number) => void;
  onBack?: () => void;
  mobileSelectionMode?: boolean;
  onEnterMobileSelectionMode?: (songId?: string) => void;
  onExitMobileSelectionMode?: () => void;
}

export function DiscoverView({
  onSongSelect,
  onAddToQueue,
  onSaveToLibrary,
  onSaveAsPlaylist,
  onUnsaveArtist,
  savedArtists = [],
  initialArtist,
  currentSongId,
  focusedSongId,
  isSelected,
  onSelectionClick,
  onDragStart,
  onDragMove,
  onDragEnd,
  hasSelection,
  onRightClickSelect,
  onArtistSongsChanged,
  onQueueAll,
  showPopup,
  onBack,
  mobileSelectionMode = false,
  onEnterMobileSelectionMode,
  onExitMobileSelectionMode,
}: DiscoverViewProps) {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string | null>(initialArtist || null);
  const [artistSongs, setArtistSongs] = useState<ArtistSong[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSongsLoading, setIsSongsLoading] = useState(!!initialArtist);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'songs'>('songs');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const savedScrollPosition = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load artists on mount, and load artist songs if pre-selected
  useEffect(() => {
    (async () => {
      try {
        // Load artist songs if we have a pre-selected artist
        if (initialArtist) {
          setSelectedArtist(initialArtist);
          setIsSongsLoading(true);
          try {
            const songs = await getArtistSongs(initialArtist);
            setArtistSongs(deduplicateSongs(songs));
          } catch (err) {
            console.error('Failed to load artist songs:', err);
            setArtistSongs([]);
          } finally {
            setIsSongsLoading(false);
          }
        }

        const result = await getArtists();
        result.sort((a, b) => a.name.localeCompare(b.name));
        setArtists(result);
      } catch (err) {
        console.error('Failed to load artists:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [initialArtist]);

  const handleArtistClick = useCallback(async (artistName: string) => {
    // Save scroll position before navigating into artist
    if (scrollRef.current) {
      savedScrollPosition.current = scrollRef.current.scrollTop;
    }

    setSelectedArtist(artistName);
    setIsSongsLoading(true);
    window.history.replaceState(null, '', `?artist=${encodeURIComponent(artistName)}`);

    try {
      const songs = await getArtistSongs(artistName);
      setArtistSongs(deduplicateSongs(songs));
    } catch (err) {
      console.error('Failed to load artist songs:', err);
      setArtistSongs([]);
    } finally {
      setIsSongsLoading(false);
    }
  }, []);

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
      return;
    }
    setSelectedArtist(null);
    setArtistSongs([]);
    window.history.replaceState(null, '', '/');

    // Restore scroll position after React re-renders the artist list
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = savedScrollPosition.current;
      }
    });
  }, [onBack]);

  const handleShareArtist = useCallback(async () => {
    if (!selectedArtist) return;
    const url = `${window.location.origin}?artist=${encodeURIComponent(selectedArtist)}`;
    await shareToClipboard(url, showPopup || (() => {}));
  }, [selectedArtist, showPopup]);

  const handleShareSong = useCallback(async (song: Song, forceClipboard = false) => {
    const inferredArtist = selectedArtist || splitArtistTitle(song).artist;
    const shareUrl = new URL('/', window.location.origin);
    if (inferredArtist) {
      shareUrl.searchParams.set('artist', inferredArtist);
    }
    shareUrl.searchParams.set('s', song.song_id);
    await shareToClipboard(shareUrl.toString(), showPopup || (() => {}), forceClipboard ? { forceClipboard: true } : undefined);
  }, [selectedArtist, showPopup]);

  // Split songs into complete and processing
  const completeSongs = useMemo(() => artistSongs.filter(s => s.status === 'COMPLETE'), [artistSongs]);
  const processingSongs: Song[] = useMemo(() =>
    artistSongs.filter(s => {
      if (s.status === 'COMPLETE' || s.status === 'ERROR') {
        return false;
      }
      if (!s.created_at) {
        return true;
      }
      const ageSeconds = (Date.now() / 1000) - s.created_at;
      return ageSeconds <= STALE_PROCESSING_WINDOW_SECONDS;
    }).map(s => ({
      song_id: s.song_id,
      title: s.title || s.song_id,
      artist: s.artist || selectedArtist || undefined,
      status: (s.status || 'QUEUED') as Song['status'],
      duration: s.duration || 0,
    })),
    [artistSongs, selectedArtist]
  );

  // Convert ArtistSong[] to Song[] for VirtualizedSongList
  const artistSongsAsSongs: Song[] = useMemo(() =>
    completeSongs.map(s => ({
      song_id: s.song_id,
      title: s.title || s.song_id,
      artist: s.artist || selectedArtist || undefined,
      status: 'COMPLETE' as const,
      duration: s.duration || 0,
      actual_id: s.actual_id,
    })),
    [completeSongs, selectedArtist]
  );

  useEffect(() => {
    onArtistSongsChanged?.(artistSongsAsSongs);
  }, [artistSongsAsSongs, onArtistSongsChanged]);

  const handleVirtualizedSongSelect = useCallback((song: Song, index: number) => {
    const artistSong = completeSongs[index];
    if (artistSong) onSongSelect(artistSong, completeSongs, selectedArtist);
  }, [completeSongs, onSongSelect, selectedArtist]);

  if (isLoading) {
    return (
      <div className="empty-state">
        <span className="text-secondary">LOADING</span>
      </div>
    );
  }

  // Artist songs view
  if (selectedArtist) {
    return (
      <>
        <div
          className="song-row discover-back-row"
          onClick={handleBack}
        >
          <span className="song-title ui-compact-action--label">
            &larr; BACK
          </span>
        </div>
        <div className="discover-artist-header">
          <span>{selectedArtist}</span>
          <div className="ui-compact-action-row">
            {artistSongs.length > 0 && (
              savedArtists.includes(selectedArtist) ? (
                <button
                  className="ui-compact-action ui-compact-action--icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onUnsaveArtist?.(selectedArtist);
                  }}
                  title="Remove artist from library"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square" strokeLinejoin="miter"><polyline points="4,12 10,18 20,6" /></svg>
                </button>
              ) : (
                <button
                  className="ui-compact-action ui-compact-action--plus"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSaveAsPlaylist(selectedArtist, artistSongs);
                  }}
                  title="Save artist to library"
                >
                  +
                </button>
              )
            )}
            <button
              className="ui-compact-action ui-compact-action--icon"
              onClick={handleShareArtist}
              title="Share artist page"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16,6 12,2 8,6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
            </button>
            {onQueueAll && completeSongs.length > 0 && (
              <button
                className="ui-compact-action ui-compact-action--queue"
                onClick={(e) => {
                  e.stopPropagation();
                  onQueueAll(completeSongs.map(s => s.song_id));
                }}
                title="Queue all songs"
              >
                &rarr;
              </button>
            )}
            <button
              className="ui-compact-action ui-compact-action--more mobile-selection-toggle"
              onClick={(e) => {
                e.stopPropagation();
                if (mobileSelectionMode) onExitMobileSelectionMode?.();
                else onEnterMobileSelectionMode?.();
              }}
              aria-label={mobileSelectionMode ? 'Exit selection mode' : 'Select songs'}
              title={mobileSelectionMode ? 'Exit selection mode' : 'Select songs'}
            >
              <MoreToggleIcon />
            </button>
          </div>
        </div>
        <div className="main-content-wrapper">
          <div className="songs-container-full">
            <div className="song-list">
              {isSongsLoading ? (
                <div className="empty-state ui-empty-state--short">
                  <span className="text-secondary">LOADING</span>
                </div>
              ) : artistSongsAsSongs.length === 0 ? (
                <div className="empty-state">
                  <span className="text-secondary">No songs found for this artist.</span>
                </div>
              ) : (
                <VirtualizedSongList
                  songs={artistSongsAsSongs}
                  currentSongId={currentSongId}
                  focusedSongId={focusedSongId}
                  onSongSelect={handleVirtualizedSongSelect}
                  onAddToQueue={onAddToQueue}
                  onSaveToLibrary={onSaveToLibrary}
                  onShareSong={(e, song) => {
                    e.stopPropagation();
                    void handleShareSong(song);
                  }}
                  isSelected={isSelected}
                  onSelectionClick={onSelectionClick}
                  onDragStart={onDragStart}
                  onDragMove={onDragMove}
                  onDragEnd={onDragEnd}
                  hasSelection={hasSelection}
                  onRightClickSelect={onRightClickSelect}
                  showSelectionTargets={mobileSelectionMode}
                  onLongPressAction={mobileSelectionMode ? undefined : (song) => {
                    void handleShareSong(song, true);
                  }}
                />
              )}
            </div>
          </div>
          <div className="action-area">
            <ConvertingSection
              processingSongs={processingSongs}
              onRetrySong={() => {}}
            />
          </div>
        </div>
      </>
    );
  }

  // Artist list view
  const filteredArtists = (() => {
    let list = searchQuery.trim()
      ? artists.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : [...artists];

    list.sort((a, b) => {
      if (sortBy === 'name') {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === 'asc' ? cmp : -cmp;
      } else {
        const cmp = a.song_count - b.song_count;
        return sortDir === 'asc' ? cmp : -cmp;
      }
    });

    return list;
  })();

  const toggleSort = (col: 'name' | 'songs') => {
    if (sortBy === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir(col === 'name' ? 'asc' : 'desc');
    }
  };

  if (artists.length === 0) {
    return (
      <div className="empty-state">
        <span className="text-secondary">No artists available yet.</span>
      </div>
    );
  }

  return (
    <div className="discover-container">
      <div className="discover-header">
        <SearchField
          value={searchQuery}
          onValueChange={setSearchQuery}
          className="filter-input"
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setSearchQuery('');
              e.currentTarget.blur();
            }
          }}
          action={searchQuery ? {
            label: '×',
            title: 'Clear search',
            className: 'search-field-clear',
            onClick: () => setSearchQuery(''),
          } : undefined}
        />
      </div>
      <div className="discover-sort-header">
        <span className="discover-sort-col" onClick={() => toggleSort('name')}>
          NAME {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </span>
        <span className="discover-sort-col discover-sort-right" onClick={() => toggleSort('songs')}>
          SONGS {sortBy === 'songs' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
        </span>
      </div>
        <div className="discover-scroll" ref={scrollRef}>
          <div className="song-list">
            {filteredArtists.length === 0 ? (
            <div className="empty-state ui-empty-state--short">
              <span className="text-secondary">No artists match &quot;{searchQuery}&quot;</span>
            </div>
          ) : (
            filteredArtists.map((artist) => (
              <div
                key={artist.name}
                className="song-row"
                onClick={() => handleArtistClick(artist.name)}
              >
                <span className="song-title">{artist.name}</span>
                <span className="duration ui-compact-action--label">{artist.song_count}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
