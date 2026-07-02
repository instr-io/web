import { useCallback, useEffect, useRef, useState } from 'react';
import { primeSongCache, recordListen, type Song } from '../lib/api';
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
  const trackedSongRef = useRef<{ song_id: string; artist?: string } | null>(null);
  const isLoadingNewSongRef = useRef(false);
  const isTransitioningTrackRef = useRef(false);
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

  const flushTrackedListen = useCallback((trackedSong = trackedSongRef.current) => {
    if (!trackedSong) return;

    const total = getAndResetListenTime();
    if (total <= 0) return;

    void recordListen(trackedSong.song_id, total, trackedSong.artist).catch((error) => {
      console.error('Failed to record listen:', error);
    });
  }, [getAndResetListenTime]);

  const applyMediaSessionMetadata = useCallback((song: Song, playlistName = '') => {
    if (!('mediaSession' in navigator)) return;

    const title = decodeHtmlEntities(song.title || 'Unknown Track');
    const artist = song.artist ? decodeHtmlEntities(song.artist) : 'instrio';
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
      album: playlistName,
      artwork: [{ src: '/mobile.jpg', sizes: '512x512', type: 'image/jpeg' }],
    });
  }, []);

  const beginTrackTransition = useCallback(() => {
    isTransitioningTrackRef.current = true;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  }, []);

  const playSong = useCallback((song: Song) => {
    const playbackUrl = song.stream_url;
    if (!playbackUrl || !audioRef.current) return;

    beginTrackTransition();

    if (trackedSongRef.current?.song_id !== song.song_id) {
      flushTrackedListen(trackedSongRef.current);
    } else {
      listenStartTimeRef.current = null;
      accumulatedListenTimeRef.current = 0;
    }

    trackedSongRef.current = { song_id: song.song_id, artist: song.artist };
    loadedSongRef.current = song.song_id;

    primeSongCache(song);
    applyMediaSessionMetadata(song, currentPlaylistName);
    setCurrentSong(song);

    isLoadingNewSongRef.current = true;
    audioRef.current.src = playbackUrl;
    audioRef.current.preload = 'auto';
    audioRef.current.play()
      .then(() => {
        isLoadingNewSongRef.current = false;
        isTransitioningTrackRef.current = false;
        setIsPlaying(true);
      })
      .catch(error => {
        console.error('Playback failed:', error);
        isLoadingNewSongRef.current = false;
        isTransitioningTrackRef.current = false;
        setIsPlaying(false);
        loadedSongRef.current = null;
      });
  }, [applyMediaSessionMetadata, audioRef, beginTrackTransition, currentPlaylistName, flushTrackedListen, setCurrentSong, setIsPlaying]);

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
    isTransitioningTrackRef.current = false;
    listenStartTimeRef.current = Date.now();
    setIsPlaying(true);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('previoustrack', () => { playPreviousRef.current(); });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        beginTrackTransition();
        void playNextRef.current();
      });
    }
  }, [beginTrackTransition, playNextRef, playPreviousRef, setIsPlaying]);

  const handleAudioPause = useCallback(() => {
    if (listenStartTimeRef.current !== null) {
      accumulatedListenTimeRef.current += (Date.now() - listenStartTimeRef.current) / 1000;
      listenStartTimeRef.current = null;
    }

    if (isLoadingNewSongRef.current || isTransitioningTrackRef.current) return;
    setIsPlaying(false);
  }, [setIsPlaying]);

  useEffect(() => {
    if (!currentSong) {
      flushTrackedListen(trackedSongRef.current);
      trackedSongRef.current = null;
      loadedSongRef.current = null;
      isTransitioningTrackRef.current = false;
      return;
    }

    const playbackUrl = currentSong.stream_url;
    if (!playbackUrl || !audioRef.current) return;

    if (trackedSongRef.current?.song_id !== currentSong.song_id) {
      flushTrackedListen(trackedSongRef.current);
    }

    trackedSongRef.current = { song_id: currentSong.song_id, artist: currentSong.artist };

    if (loadedSongRef.current === currentSong.song_id) {
      return;
    }

    loadedSongRef.current = currentSong.song_id;
    listenStartTimeRef.current = null;
    accumulatedListenTimeRef.current = 0;

    applyMediaSessionMetadata(currentSong, currentPlaylistName);
    beginTrackTransition();

    isLoadingNewSongRef.current = true;
    audioRef.current.src = playbackUrl;
    audioRef.current.preload = 'auto';
    audioRef.current.play()
      .then(() => {
        isLoadingNewSongRef.current = false;
        isTransitioningTrackRef.current = false;
        setIsPlaying(true);
      })
      .catch(error => {
        console.error('Playback failed:', error);
        isLoadingNewSongRef.current = false;
        isTransitioningTrackRef.current = false;
        setIsPlaying(false);
        loadedSongRef.current = null;
      });
  }, [applyMediaSessionMetadata, audioRef, beginTrackTransition, currentPlaylistName, currentSong, flushTrackedListen, setIsPlaying]);

  useEffect(() => {
    const handlePageHide = () => {
      flushTrackedListen(trackedSongRef.current);
    };

    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('beforeunload', handlePageHide);

    return () => {
      handlePageHide();
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('beforeunload', handlePageHide);
    };
  }, [flushTrackedListen]);

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
      beginTrackTransition();
      void playNextRef.current();
    });

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [audioRef, beginTrackTransition, playNextRef, playPreviousRef, setIsPlaying]);

  useEffect(() => {
    if (!currentSong) return;
    applyMediaSessionMetadata(currentSong, currentPlaylistName);
  }, [applyMediaSessionMetadata, currentPlaylistName, currentSong]);

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

  const handleAudioEnded = useCallback(() => {
    beginTrackTransition();
    void playNextRef.current();
  }, [beginTrackTransition, playNextRef]);

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
    handleAudioEnded,
    handleAudioError,
    getAndResetListenTime,
  };
}
