import { useCallback, useRef, useState } from 'react';
import {
  addToOfficialQueue,
  getPlaybackState,
  getQueue,
  getSong,
  popNextSong,
  type QueueItem,
  type Song,
  setCurrentSong as setCurrentSongAPI,
  updateUnofficialQueueFromSongs,
} from '../lib/api';
import { shuffleArray } from '../lib/utils';

interface UsePlaybackQueueControllerParams {
  currentSong: Song | undefined;
  setCurrentSong: (song: Song | undefined) => void;
  setIsPlaying: (playing: boolean) => void;
  setIsShuffled: (shuffled: boolean) => void;
  setRepeatAll: (repeat: boolean) => void;
  setRepeatOne: (repeat: boolean) => void;
  playNextInProgressRef: React.MutableRefObject<boolean>;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isShuffled: boolean;
  repeatAll: boolean;
  repeatOne: boolean;
  getAndResetListenTime: () => number;
}

export function usePlaybackQueueController({
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
  getAndResetListenTime,
}: UsePlaybackQueueControllerParams) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [playbackHistory, setPlaybackHistory] = useState<Song[]>([]);

  const localSongListRef = useRef<Song[]>([]);
  const localQueueIndexRef = useRef(-1);
  const onQueueExhaustedRef = useRef<(() => void) | null>(null);

  const setLocalSongList = useCallback((songs: Song[], currentIndex: number) => {
    localSongListRef.current = songs;
    localQueueIndexRef.current = currentIndex;
  }, []);

  const loadQueue = useCallback(async () => {
    try {
      const queueItems = await getQueue();
      setQueue(queueItems);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  }, []);

  const loadPlaybackState = useCallback(async () => {
    try {
      const state = await getPlaybackState();
      setIsShuffled(state.shuffle_enabled);
      setRepeatAll(state.repeat_all);
      setRepeatOne(state.repeat_one);
    } catch (err) {
      console.error('Failed to load playback state:', err);
    }
  }, [setIsShuffled, setRepeatAll, setRepeatOne]);

  const rebuildUnofficialQueue = useCallback(async (shuffleOverride?: boolean) => {
    const songs = localSongListRef.current;
    const idx = localQueueIndexRef.current;
    if (songs.length === 0) return;

    const shouldShuffle = shuffleOverride !== undefined ? shuffleOverride : isShuffled;
    const songsAfter = songs.slice(idx + 1);
    const songsBefore = songs.slice(0, idx + 1);
    let songsToQueue = [...songsAfter, ...songsBefore].slice(0, 50);

    if (shouldShuffle) {
      songsToQueue = shuffleArray(songsToQueue);
    }

    try {
      const currentSongId = songs[idx]?.song_id || '';
      await updateUnofficialQueueFromSongs(songsToQueue, currentSongId, 50);
      await loadQueue();
    } catch (err) {
      console.error('Failed to rebuild unofficial queue:', err);
    }
  }, [isShuffled, loadQueue]);

  const playNextFromLocal = useCallback(async () => {
    const localSongs = localSongListRef.current;
    if (localSongs.length === 0) {
      setIsPlaying(false);
      return;
    }

    let nextIndex: number;
    if (isShuffled) {
      nextIndex = Math.floor(Math.random() * localSongs.length);
    } else {
      nextIndex = (localQueueIndexRef.current + 1) % localSongs.length;
      if (nextIndex === 0 && !repeatAll) {
        setCurrentSong(undefined);
        setIsPlaying(false);
        return;
      }
    }

    localQueueIndexRef.current = nextIndex;
    const nextLocalSong = localSongs[nextIndex];

    try {
      const songToPlay = await getSong(nextLocalSong.song_id);
      setCurrentSong(songToPlay);
      setCurrentSongAPI(songToPlay.song_id).catch(() => {});
    } catch {
      const fallbackPlaybackUrl = nextLocalSong.stream_url;
      if (fallbackPlaybackUrl) {
        setCurrentSong({ ...nextLocalSong, stream_url: fallbackPlaybackUrl });
      } else {
        setCurrentSong(undefined);
        setIsPlaying(false);
      }
    }
  }, [isShuffled, repeatAll, setCurrentSong, setIsPlaying]);

  const playNext = useCallback(async () => {
    if (playNextInProgressRef.current) return;
    playNextInProgressRef.current = true;

    try {
      if (repeatOne && currentSong?.stream_url && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(console.error);
        return;
      }

      const previousSongId = currentSong?.song_id;
      const previousArtist = currentSong?.artist || 'Unknown';
      const listenDuration = getAndResetListenTime();

      if (currentSong) {
        setPlaybackHistory(prev => [currentSong, ...prev.slice(0, 49)]);
      }

      try {
        const nextSong = await popNextSong(previousSongId, listenDuration, previousArtist);
        if (nextSong) {
          const songToPlay = await getSong(nextSong.song_id);
          setCurrentSong(songToPlay);
          setCurrentSongAPI(songToPlay.song_id).catch(err =>
            console.error('Failed to set current song on backend:', err)
          );
          loadQueue().catch(() => {});
        } else {
          try {
            onQueueExhaustedRef.current?.();
            await rebuildUnofficialQueue();

            const rebuiltNextSong = await popNextSong();
            if (rebuiltNextSong) {
              const songToPlay = await getSong(rebuiltNextSong.song_id);
              setCurrentSong(songToPlay);
              setCurrentSongAPI(songToPlay.song_id).catch(err =>
                console.error('Failed to set current song on backend:', err)
              );
              loadQueue().catch(() => {});
            } else {
              await playNextFromLocal();
            }
          } catch (error) {
            console.error('Failed to refill queue, trying local fallback:', error);
            await playNextFromLocal();
          }
        }
      } catch (err) {
        console.error('Failed to play next song from backend, trying local fallback:', err);
        await playNextFromLocal();
      }
    } finally {
      playNextInProgressRef.current = false;
    }
  }, [
    audioRef,
    currentSong,
    getAndResetListenTime,
    loadQueue,
    playNextInProgressRef,
    playNextFromLocal,
    rebuildUnofficialQueue,
    repeatOne,
    setCurrentSong,
  ]);

  const playPrevious = useCallback(() => {
    if (!audioRef.current) return;

    if (audioRef.current.currentTime > 2) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (playbackHistory.length === 0) {
      return;
    }

    const previousSong = playbackHistory[0];

    if (currentSong) {
      addToOfficialQueue([currentSong.song_id], true).catch(err =>
        console.error('Failed to add current song back to queue:', err)
      );
    }

    setCurrentSong(previousSong);
    setPlaybackHistory(prev => prev.slice(1));
    audioRef.current.play().catch(console.error);
    setIsPlaying(true);
    loadQueue().catch(err => console.error('Failed to reload queue:', err));
  }, [audioRef, currentSong, loadQueue, playbackHistory, setCurrentSong, setIsPlaying]);

  return {
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
  };
}
