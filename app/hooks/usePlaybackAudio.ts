import { useCallback, useEffect, useRef, useState } from 'react';
import type { Song } from '../lib/api';
import { decodeHtmlEntities } from '../lib/utils';

interface UsePlaybackAudioParams {
  currentSong: Song | undefined;
  currentPlaylistName: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  playNextRef: React.MutableRefObject<() => void>;
  playPreviousRef: React.MutableRefObject<() => void>;
  playNextInProgressRef: React.MutableRefObject<boolean>;
  setCurrentSong: (song: Song | undefined) => void;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
}

export function usePlaybackAudio({
  currentSong,
  currentPlaylistName,
  audioRef,
  playNextRef,
  playPreviousRef,
  playNextInProgressRef,
  setCurrentSong,
  isPlaying,
  setIsPlaying,
}: UsePlaybackAudioParams) {
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const loadedSongRef = useRef<string | null>(null);
  const isLoadingNewSongRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const listenStartTimeRef = useRef<number | null>(null);
  const accumulatedListenTimeRef = useRef(0);

  const getAndResetListenTime = useCallback(() => {
    if (listenStartTimeRef.current !== null) {
      accumulatedListenTimeRef.current += (Date.now() - listenStartTimeRef.current) / 1000;
      listenStartTimeRef.current = null;
    }
    const total = accumulatedListenTimeRef.current;
    accumulatedListenTimeRef.current = 0;
    return total;
  }, []);

  const playSong = useCallback((song: Song) => {
    const playbackUrl = song.stream_url;
    if (!playbackUrl || !audioRef.current) return;

    listenStartTimeRef.current = null;
    accumulatedListenTimeRef.current = 0;
    loadedSongRef.current = song.song_id;

    setCurrentSong(song);

    isLoadingNewSongRef.current = true;
    audioRef.current.src = playbackUrl;
    audioRef.current.preload = 'auto';
    audioRef.current.load();
    audioRef.current.play()
      .then(() => {
        isLoadingNewSongRef.current = false;
        setIsPlaying(true);
      })
      .catch(error => {
        console.error('Playback failed:', error);
        isLoadingNewSongRef.current = false;
        setIsPlaying(false);
        loadedSongRef.current = null;
      });
  }, [audioRef, setCurrentSong, setIsPlaying]);

  const handleSeek = useCallback((progress: number) => {
    if (audioRef.current && duration) {
      const newTime = progress * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(Math.floor(newTime));
    }
  }, [audioRef, duration]);

  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current) return;

    const time = Math.floor(audioRef.current.currentTime);
    setCurrentTime(time);
    if (time > 0) {
      consecutiveErrorsRef.current = 0;
    }
  }, [audioRef]);

  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;

    if (currentSong?.duration && currentSong.duration > 0) {
      setDuration(currentSong.duration);
    } else {
      setDuration(Math.floor(audioRef.current.duration));
    }
  }, [audioRef, currentSong]);

  const handleAudioPlay = useCallback(() => {
    listenStartTimeRef.current = Date.now();
    setIsPlaying(true);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('previoustrack', () => { playPreviousRef.current(); });
      navigator.mediaSession.setActionHandler('nexttrack', () => { playNextRef.current(); });
    }
  }, [playNextRef, playPreviousRef, setIsPlaying]);

  const handleAudioPause = useCallback(() => {
    if (listenStartTimeRef.current !== null) {
      accumulatedListenTimeRef.current += (Date.now() - listenStartTimeRef.current) / 1000;
      listenStartTimeRef.current = null;
    }

    if (isLoadingNewSongRef.current) return;
    setIsPlaying(false);
  }, [setIsPlaying]);

  useEffect(() => {
    if (!currentSong) {
      loadedSongRef.current = null;
      return;
    }

    const playbackUrl = currentSong.stream_url;
    if (!playbackUrl || !audioRef.current) return;

    if (loadedSongRef.current === currentSong.song_id) {
      return;
    }

    loadedSongRef.current = currentSong.song_id;
    listenStartTimeRef.current = null;
    accumulatedListenTimeRef.current = 0;

    if ('mediaSession' in navigator) {
      const title = decodeHtmlEntities(currentSong.title || 'Unknown Track');
      const artist = currentSong.artist ? decodeHtmlEntities(currentSong.artist) : 'instrio';
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album: '',
        artwork: [{ src: '/mobile.jpg', sizes: '512x512', type: 'image/jpeg' }],
      });
    }

    isLoadingNewSongRef.current = true;
    audioRef.current.src = playbackUrl;
    audioRef.current.preload = 'auto';
    audioRef.current.load();
    audioRef.current.play()
      .then(() => {
        isLoadingNewSongRef.current = false;
        setIsPlaying(true);
      })
      .catch(error => {
        console.error('Playback failed:', error);
        isLoadingNewSongRef.current = false;
        setIsPlaying(false);
        loadedSongRef.current = null;
      });
  }, [audioRef, currentSong, setIsPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
      if (audioRef.current) {
        audioRef.current.play().catch(console.error);
        setIsPlaying(true);
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      playPreviousRef.current();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      playNextRef.current();
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [audioRef, playNextRef, playPreviousRef, setIsPlaying]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong) return;

    const existing = navigator.mediaSession.metadata;
    const title = decodeHtmlEntities(currentSong.title || 'Unknown Track');
    const artist = currentSong.artist ? decodeHtmlEntities(currentSong.artist) : 'instrio';
    const album = currentPlaylistName || '';

    if (existing) {
      existing.title = title;
      existing.artist = artist;
      existing.album = album;
    } else {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist,
        album,
        artwork: [
          { src: '/mobile.jpg', sizes: '512x512', type: 'image/jpeg' },
        ],
      });
    }
  }, [currentPlaylistName, currentSong]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  const handleAudioError = useCallback(() => {
    if (isLoadingNewSongRef.current || playNextInProgressRef.current) return;

    consecutiveErrorsRef.current++;
    if (consecutiveErrorsRef.current > 3) {
      console.error('Too many consecutive audio errors, stopping playback');
      setIsPlaying(false);
      return;
    }

    console.error('Audio load error, advancing to next song');
    loadedSongRef.current = null;
    playNextRef.current();
  }, [playNextInProgressRef, playNextRef, setIsPlaying]);

  return {
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
  };
}
