'use client';

import { useState } from 'react';
import { Song } from '@/app/lib/api';
import { splitArtistTitle, decodeHtmlEntities } from '@/app/lib/utils';
import './ConvertingSection.css';

// Strip common YouTube suffixes for display (mirrors Go NormalizeTitle).
const TITLE_SUFFIX_RE = /[\(\[]\s*(?:official\s+(?:(?:music|hd|4k|hq|8k|full)\s+)*(?:video|audio|lyric\s+video|visualizer)|music\s+video|lyric\s+video|visualizer|audio|video|mv|m\/v|4k|hd|hq|8k)\s*[\)\]]/gi;
const UNBRACKETED_SUFFIX_RE = /\s+(?:official\s+(?:(?:music|hd|4k|hq|8k|full)\s+)*(?:video|audio|lyric\s+video|visualizer)|music\s+video|lyric\s+video)\s*$/i;

function cleanDisplayTitle(title: string): string {
  return title.replace(TITLE_SUFFIX_RE, '').replace(UNBRACKETED_SUFFIX_RE, '').replace(/\s{2,}/g, ' ').trim();
}

interface ConvertingSectionProps {
  processingSongs: Song[];
  onRetrySong: (e: React.MouseEvent, song: Song) => void;
  onDeleteSong?: (e: React.MouseEvent, song: Song) => void;
  searchQuery?: string;
}

// Helper function to check if a song should show retry button
function shouldShowRetry(song: Song): boolean {
  // Always show retry for ERROR status
  if (song.status === 'ERROR') {
    return true;
  }

  // Show retry for stuck CONVERTING or PREPARING_TO_CONVERT songs (> 24 hours)
  if (song.status === 'CONVERTING' || song.status === 'PREPARING_TO_CONVERT') {
    if (song.timestamp) {
      const now = Date.now() / 1000; // Convert to seconds
      const timeDiff = now - song.timestamp;
      const twentyFourHours = 24 * 60 * 60;
      return timeDiff > twentyFourHours;
    }
  }

  return false;
}

export function ConvertingSection({ processingSongs, onRetrySong, onDeleteSong, searchQuery }: ConvertingSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredSongs = searchQuery
    ? processingSongs.filter(song => {
        const q = searchQuery.toLowerCase();
        return (song.title || '').toLowerCase().includes(q) || (song.artist || '').toLowerCase().includes(q);
      })
    : processingSongs;

  if (filteredSongs.length === 0) {
    return null;
  }

  return (
    <div className={`converting-section ${isCollapsed ? 'collapsed' : 'expanded'}`}>
      <div 
        className="converting-header"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3>CONVERTING</h3>
        <span className={`converting-chevron ${isCollapsed ? 'collapsed' : ''}`}>▼</span>
      </div>
      
      <div className={`converting-content ${isCollapsed ? 'collapsed' : 'expanded'}`}>
        {filteredSongs.map((song) => {
          const decoded = cleanDisplayTitle(decodeHtmlEntities(song.title || `https://youtube.com/watch?v=${song.song_id}`));
          const { artist, title } = splitArtistTitle({ ...song, title: decoded });
          return (
            <div key={song.song_id} className="converting-row">
              <div className="converting-left">
                <span className="converting-title">
                  {artist ? <><span className="converting-artist">{artist}</span><span className="converting-dot">·</span>{title}</> : decoded}
                </span>
                <div className="converting-actions">
                  {shouldShowRetry(song) && (
                    <button
                      className="converting-btn retry-btn"
                      onClick={(e) => onRetrySong(e, song)}
                      title="Retry conversion"
                    >
                      ↻
                    </button>
                  )}
                  {onDeleteSong && (
                    <button
                      className="converting-btn delete-btn"
                      onClick={(e) => onDeleteSong(e, song)}
                      title="Delete song"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <span className="converting-status">{song.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
} 