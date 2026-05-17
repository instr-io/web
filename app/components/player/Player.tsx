'use client';

import { useState, useEffect, useCallback } from 'react';
import { IconButton } from '@/app/components/player/IconButton';
import { Slider } from '@/app/components/player/Slider';
import { Song, toggleShuffle as apiToggleShuffle, toggleRepeat as apiToggleRepeat, getPlaybackState } from '@/app/lib/api';
import { buildApiUrl } from '@/app/lib/env';

interface PlayerProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeek: (progress: number) => void;
  onNext: () => void;
  onPrevious: () => void;
  onLoadQueue?: () => Promise<void>;
  isShuffled?: boolean;
  setIsShuffled?: (value: boolean) => void;
  repeatAll?: boolean;
  setRepeatAll?: (value: boolean) => void;
  repeatOne?: boolean;
  setRepeatOne?: (value: boolean) => void;
  rebuildUnofficialQueue?: (shuffleOverride?: boolean) => Promise<void>;
  compactMobileSpacing?: boolean;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function Player({
  isPlaying,
  currentTime,
  duration,
  onPlayPause,
  onSeek,
  onNext,
  onPrevious,
  onLoadQueue,
  isShuffled: shuffledProp,
  setIsShuffled: setShuffledProp,
  repeatAll: repeatAllProp,
  setRepeatAll: setRepeatAllProp,
  repeatOne: repeatOneProp,
  setRepeatOne: setRepeatOneProp,
  rebuildUnofficialQueue,
  compactMobileSpacing = false,
}: PlayerProps) {
  // Use local state as fallback if props not provided (backwards compatibility)
  const [localIsShuffled, setLocalIsShuffled] = useState(false);
  const [localRepeatAll, setLocalRepeatAll] = useState(false);
  const [localRepeatOne, setLocalRepeatOne] = useState(false);

  // Use controlled props if available, otherwise use local state
  const isShuffled = shuffledProp !== undefined ? shuffledProp : localIsShuffled;
  const setIsShuffled = setShuffledProp || setLocalIsShuffled;
  const repeatAll = repeatAllProp !== undefined ? repeatAllProp : localRepeatAll;
  const setRepeatAll = setRepeatAllProp || setLocalRepeatAll;
  const repeatOne = repeatOneProp !== undefined ? repeatOneProp : localRepeatOne;
  const setRepeatOne = setRepeatOneProp || setLocalRepeatOne;

  // Ping API every 60s to keep Lambda warm while user is listening
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(buildApiUrl('/health')).catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const loadPlaybackState = useCallback(async () => {
    try {
      const state = await getPlaybackState();
      setIsShuffled(state.shuffle_enabled);
      setRepeatAll(state.repeat_all);
      setRepeatOne(state.repeat_one);
    } catch (err) {
      console.error('Failed to load playback state:', err);
      // Keep default values on error
    }
  }, [setIsShuffled, setRepeatAll, setRepeatOne]);

  // Load initial playback state only if not using controlled props
  useEffect(() => {
    if (shuffledProp === undefined) {
      loadPlaybackState();
    }
  }, [shuffledProp, loadPlaybackState]);

  const handleToggleShuffle = async () => {
    const newState = !isShuffled;
    setIsShuffled(newState);

    try {
      // Save flag to backend (just toggles Redis flag, no reshuffle)
      await apiToggleShuffle();

      // Rebuild queue in new order from frontend (pass newState to avoid stale closure)
      if (rebuildUnofficialQueue) {
        await rebuildUnofficialQueue(newState);
      } else if (onLoadQueue) {
        await onLoadQueue();
      }
    } catch (err) {
      console.error('Failed to toggle shuffle:', err);
      setIsShuffled(!newState);
    }
  };

  const handleToggleRepeat = async () => {
    try {
      const response = await apiToggleRepeat();
      setRepeatAll(response.repeat_all);
      setRepeatOne(response.repeat_one);
    } catch (err) {
      console.error('Failed to toggle repeat:', err);
    }
  };

  const progress = duration ? currentTime / duration : 0;

  // Determine repeat mode for display
  const repeatMode = repeatOne ? 'one' : repeatAll ? 'all' : 'none';

  return (
    <footer className={`player ${compactMobileSpacing ? 'player--compact-mobile' : ''}`}>
      <div className="player-controls">
        <IconButton
          icon="shuffle"
          active={isShuffled}
          onClick={handleToggleShuffle}
          title="Shuffle"
        />
        <IconButton
          icon="previous"
          onClick={onPrevious}
          title="Previous"
        />
        <IconButton
          icon={isPlaying ? 'pause' : 'play'}
          onClick={onPlayPause}
          size="large"
          title={isPlaying ? 'Pause' : 'Play'}
        />
        <IconButton
          icon="next"
          onClick={onNext}
          title="Next"
        />
        <IconButton
          icon="repeat"
          active={repeatAll || repeatOne}
          onClick={handleToggleRepeat}
          title={`Repeat ${repeatMode}`}
        />
      </div>
      <div className="player-progress">
        <span className="time">{formatDuration(currentTime)}</span>
        <Slider value={progress} onChange={onSeek} />
        <span className="time">{formatDuration(duration)}</span>
      </div>
    </footer>
  );
} 
