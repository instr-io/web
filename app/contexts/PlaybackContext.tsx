'use client';

import { createContext, useContext, useState, useRef, ReactNode } from 'react';
import { Song, QueueItem } from '../lib/api';
import { usePlaybackAudio } from '../hooks/usePlaybackAudio';
import { usePlaybackQueueController } from '../hooks/usePlaybackQueueController';

interface PlaybackContextType {
  currentSong: Song | undefined;
  setCurrentSong: (song: Song | undefined) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentTime: number;
  setCurrentTime: (time: number) => void;
  duration: number;
  setDuration: (duration: number) => void;
  queue: QueueItem[];
  setQueue: React.Dispatch<React.SetStateAction<QueueItem[]>>;
  playbackHistory: Song[];
  setPlaybackHistory: React.Dispatch<React.SetStateAction<Song[]>>;
  isShuffled: boolean;
  setIsShuffled: (shuffled: boolean) => void;
  repeatAll: boolean;
  setRepeatAll: (repeat: boolean) => void;
  repeatOne: boolean;
  setRepeatOne: (repeat: boolean) => void;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  loadQueue: () => Promise<void>;
  loadPlaybackState: () => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => void;
  playNextRef: React.RefObject<() => void>;
  playPreviousRef: React.RefObject<() => void>;
  handleSeek: (progress: number) => void;
  getAndResetListenTime: () => number;
  setLocalSongList: (songs: Song[], currentIndex: number) => void;
  playSong: (song: Song) => void;
  rebuildUnofficialQueue: (shuffleOverride?: boolean) => Promise<void>;
  onQueueExhaustedRef: React.MutableRefObject<(() => void) | null>;
}

const PlaybackContext = createContext<PlaybackContextType | null>(null);

export function usePlaybackContext() {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlaybackContext must be used within PlaybackProvider');
  return ctx;
}

interface PlaybackProviderProps {
  children: ReactNode;
  currentPlaylistName?: string;
}

export function PlaybackProvider({ children, currentPlaylistName = '' }: PlaybackProviderProps) {
  const [currentSong, setCurrentSong] = useState<Song | undefined>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffled, setIsShuffled] = useState(false);
  const [repeatAll, setRepeatAll] = useState(false);
  const [repeatOne, setRepeatOne] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playNextRef = useRef<() => void>(() => {});
  const playPreviousRef = useRef<() => void>(() => {});
  const playNextInProgressRef = useRef(false);
  const audio = usePlaybackAudio({
    currentSong,
    currentPlaylistName,
    audioRef,
    playNextRef,
    playPreviousRef,
    playNextInProgressRef,
    setCurrentSong,
    isPlaying,
    setIsPlaying,
  });
  const queueController = usePlaybackQueueController({
    currentSong,
    setCurrentSong,
    setIsPlaying,
    setIsShuffled,
    setRepeatAll,
    setRepeatOne,
    playNextInProgressRef,
    audioRef,
    isShuffled,
    repeatAll,
    repeatOne,
  });

  const {
    queue,
    setQueue,
    playbackHistory,
    setPlaybackHistory,
    loadQueue,
    loadPlaybackState,
    playNext,
    playPrevious,
    setLocalSongList,
    rebuildUnofficialQueue,
    onQueueExhaustedRef,
  } = queueController;

  const {
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    playSong,
    handleSeek,
    handleTimeUpdate,
    handleLoadedMetadata,
    handleAudioPlay,
    handleAudioPause,
    handleAudioError,
    getAndResetListenTime,
  } = audio;

  playNextRef.current = playNext;
  playPreviousRef.current = playPrevious;

  const value: PlaybackContextType = {
    currentSong, setCurrentSong,
    isPlaying, setIsPlaying,
    currentTime, setCurrentTime,
    duration, setDuration,
    queue, setQueue,
    playbackHistory, setPlaybackHistory,
    isShuffled, setIsShuffled,
    repeatAll, setRepeatAll,
    repeatOne, setRepeatOne,
    audioRef,
    loadQueue, loadPlaybackState,
    playNext, playPrevious,
    playNextRef, playPreviousRef,
    handleSeek,
    getAndResetListenTime,
    setLocalSongList,
    playSong,
    rebuildUnofficialQueue,
    onQueueExhaustedRef,
  };

  return (
    <PlaybackContext.Provider value={value}>
      {children}
      <audio
        ref={audioRef}
        onEnded={playNext}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={handleAudioPlay}
        onPause={handleAudioPause}
        onError={handleAudioError}
      />
    </PlaybackContext.Provider>
  );
}
